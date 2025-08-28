// Fetch vehicles and render simple cards
async function loadVehicles() {
  try {
    const res = await fetch("/api/vehicles");
    const vehicles = await res.json();

    const grid = document.getElementById("vehicleGrid");
    grid.innerHTML = ""; // clear

    vehicles.forEach(v => {
      const card = document.createElement("article");
      card.className = "card";

      // image (fallback to placeholder if missing/broken)
      const img = document.createElement("img");
      img.alt = v.name;
      img.loading = "lazy";
      img.src = v.image_url || "/photos/placeholder.jpg";
      img.onerror = () => (img.src = "/photos/placeholder.jpg");

      const name = document.createElement("h3");
      name.textContent = v.name;

      const meta = document.createElement("p");
      meta.className = "muted";
      meta.textContent = `${v.type} • ${v.fuel}`;

      const price = document.createElement("p");
      price.innerHTML =
        `<strong>Rent/day:</strong> $${Number(v.price_per_day_rent).toFixed(2)} &nbsp; | &nbsp; ` +
        `<strong>Buy:</strong> $${Number(v.price_buy).toLocaleString()}`;

      card.appendChild(img);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(price);
      grid.appendChild(card);
    });
  } catch (e) {
    console.error("Failed to load vehicles:", e);
    document.getElementById("vehicleGrid").textContent =
      "Could not load vehicles. Please try again.";
  }
}

loadVehicles();
