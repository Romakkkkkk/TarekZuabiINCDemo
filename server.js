// server.js
const path = require("path");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mysql = require("mysql2/promise");

const app = express();
const PORT = 4000;

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: "formal-car-leasing",
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 },
  })
);

// --- Static ---
app.use(express.static(path.join(__dirname, "public")));

// We'll assign q() after DB is ready
let q;

// ---------- Routes (define BEFORE start so it's definitely in scope) ----------
function wireApiRoutes() {
  // health
  app.get("/api/health", (req, res) => res.json({ ok: true }));

  // vehicles
  app.get("/api/vehicles", async (req, res) => {
    try {
      const rows = await q(`
        SELECT id, name, type, fuel, price_per_day_rent, price_buy,
               image_url
        FROM vehicles
        ORDER BY id ASC
      `);
      res.json(rows);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch vehicles." });
    }
  });

  // contact
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;
      if (!name || !email || !message) {
        return res.status(400).json({ error: "Missing fields" });
      }
      await q(
        `INSERT INTO contacts (name,email,message) VALUES (?,?,?)`,
        [name, email, message]
      );
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to save contact." });
    }
  });

  // order
  app.post("/api/order", async (req, res) => {
    try {
      const { customer_name, email, phone, order_type, start_date, end_date, items } = req.body;
      if (!customer_name || !email || !order_type || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const details = [];
      for (const { vehicle_id, quantity } of items) {
        const v = (await q(`SELECT * FROM vehicles WHERE id = ?`, [vehicle_id]))[0];
        if (!v) continue;
        const price = order_type === "buy" ? v.price_buy : v.price_per_day_rent;
        details.push({ vehicle_id, quantity, price_each: price });
      }

      // days for rental
      let days = 1;
      if (order_type === "rent" && start_date && end_date) {
        const sd = new Date(start_date);
        const ed = new Date(end_date);
        const diffMs = ed - sd;
        days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }

      let total = 0;
      for (const d of details) {
        total += d.price_each * d.quantity * (order_type === "rent" ? days : 1);
      }

      const result = await q(
        `INSERT INTO orders (customer_name,email,phone,order_type,start_date,end_date,total)
         VALUES (?,?,?,?,?,?,?)`,
        [
          customer_name,
          email,
          phone || "",
          order_type,
          start_date || null,
          end_date || null,
          Number(total.toFixed(2)),
        ]
      );
      const orderId = result.insertId;

      for (const d of details) {
        await q(
          `INSERT INTO order_items (order_id, vehicle_id, quantity, price_each) VALUES (?,?,?,?)`,
          [orderId, d.vehicle_id, d.quantity, d.price_each]
        );
      }

      req.session.lastOrder = { orderId, total: Number(total.toFixed(2)), when: Date.now() };
      res.json({ ok: true, orderId, total: Number(total.toFixed(2)), days });
    } catch (e) {
      res.status(500).json({ error: "Failed to create order." });
    }
  });

  // last order
  app.get("/api/last-order", (req, res) => {
    res.json({ lastOrder: req.session.lastOrder || null });
  });

  // Catch-all (Express 5 friendly) — LAST
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

// ---------- Schema + seed ----------
async function ensureTables() {
  try {
    await q(`CREATE TABLE IF NOT EXISTS vehicles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type ENUM('car','truck') NOT NULL DEFAULT 'car',
      fuel ENUM('gasoline','diesel','electric') NOT NULL DEFAULT 'gasoline',
      price_per_day_rent DECIMAL(10,2) NOT NULL DEFAULT 0,
      price_buy DECIMAL(10,2) NOT NULL DEFAULT 0,
      image_url VARCHAR(255) DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await q(`CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await q(`CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_name VARCHAR(100) NOT NULL,
      email VARCHAR(120) NOT NULL,
      phone VARCHAR(50),
      order_type ENUM('rent','buy') NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      total DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    await q(`CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      vehicle_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      price_each DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`);

    // Ensure a unique index on vehicle name (if missing)
    const idx = await q(
      `SELECT COUNT(*) AS exists_idx
         FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'vehicles'
          AND index_name = 'uniq_vehicle_name'`
    );
    if ((idx[0]?.exists_idx ?? 0) === 0) {
      await q(`ALTER TABLE vehicles ADD UNIQUE KEY uniq_vehicle_name (name)`);
    }

    // UPSERT seed (always apply)
    const seed = [
      ["BMW",         "car", "gasoline", 39.99, 16999.0, "/photos/bmw.jpg"],
      ["Bugatti",     "car", "electric", 59.99, 28999.0, "/photos/bugatti.jpg"],
      ["Lamborghini", "car", "diesel",   79.99, 35999.0, "/photos/lamborghini.jpg"],
      ["Luxury Car",  "car", "electric", 89.99, 39999.0, "/photos/luxurycar.jpg"],
    ];

    for (const s of seed) {
      await q(
        `INSERT INTO vehicles (name, type, fuel, price_per_day_rent, price_buy, image_url)
         VALUES (?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE
           type = VALUES(type),
           fuel = VALUES(fuel),
           price_per_day_rent = VALUES(price_per_day_rent),
           price_buy = VALUES(price_buy),
           image_url = VALUES(image_url)`,
        s
      );
    }

    console.log("🌱 Seed applied (UPSERT).");
  } catch (e) {
    console.error("DB init error:", e.message);
    throw e;
  }
}
async function replaceInventoryWithSeed() {
  console.log("⚠️ Replacing vehicles with current seed (clearing related orders)...");
  await q(`SET FOREIGN_KEY_CHECKS=0`);
  await q(`DELETE FROM order_items`);
  await q(`DELETE FROM orders`);
  await q(`DELETE FROM vehicles`);
  await q(`ALTER TABLE vehicles AUTO_INCREMENT = 1`);
  await q(`SET FOREIGN_KEY_CHECKS=1`);

  const seed = [
    ["BMW",         "car", "gasoline", 39.99, 16999.0, "/photos/bmw.jpg"],
    ["Bugatti",     "car", "electric", 59.99, 28999.0, "/photos/bugatti.jpg"],
    ["Lamborghini", "car", "diesel",   79.99, 35999.0, "/photos/lamborghini.jpg"],
    ["Luxury Car",  "car", "electric", 89.99, 39999.0, "/photos/luxurycar.jpg"],
  ];

  for (const s of seed) {
    await q(
      `INSERT INTO vehicles (name,type,fuel,price_per_day_rent,price_buy,image_url)
       VALUES (?,?,?,?,?,?)`,
      s
    );
  }
  console.log("✅ Inventory replaced with seed.");
}


// ---------- DB bootstrap + app start ----------
(async function start() {
  try {
    // 1) Ensure database exists
    const admin = await mysql.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "", // add if you set one
    });
    await admin.query(
      "CREATE DATABASE IF NOT EXISTS car_leasing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"
    );
    await admin.end();
    console.log("✅ Database ready (car_leasing_db).");

    // 2) Connect pool to that DB
    const pool = mysql.createPool({
      host: "127.0.0.1",
      user: "root",
      password: "", // add if needed
      database: "car_leasing_db",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // 3) Query helper
    q = async (sql, params = []) => {
      const [rows] = await pool.execute(sql, params);
      return rows;
    };

    // 4) Ensure schema + seed
    await ensureTables();
    //await replaceInventoryWithSeed();
    // DEV ONLY: fix root to modern auth so CLI works (empty password)


    // 5) Wire routes and listen
    wireApiRoutes();
    app.listen(PORT, () => {
      console.log(`🚘 Car Leasing server on http://localhost:${PORT}`);
      console.log("✅ MySQL connected and tables ensured.");
    });
  } catch (err) {
    console.error("❌ Startup error:", err.message);
    process.exit(1);
  }
})();
