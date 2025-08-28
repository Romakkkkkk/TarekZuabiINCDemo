// leasing.js — render selectable vehicles, compute totals, submit order

const state = {
  vehicles: [],
  quantities: new Map(), // vehicle_id -> qty
};

const $ = (sel) => document.querySelector(sel);
const fmtMoney = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadVehicles() {
  const res = await fetch('/api/vehicles');
  const data = await res.json();
  state.vehicles = data;
  renderVehicles();
  updateTotals();
}

function renderVehicles() {
  const list = $('#leasingList');
  list.innerHTML = '';

  if (!state.vehicles.length) {
    list.textContent = 'No vehicles available.';
    return;
  }

  state.vehicles.forEach(v => {
    const qty = state.quantities.get(v.id) || 0;

    const item = document.createElement('div');
    item.className = 'order-item';

    // image (with fallback)
    const img = document.createElement('img');
    img.className = 'img-placeholder small'; // gets overridden by real img styling
    img.src = v.image_url || '/photos/placeholder.jpg';
    img.alt = v.name;
    img.width = 120; img.height = 80;
    img.loading = 'lazy';
    img.onerror = () => (img.src = '/photos/placeholder.jpg');

    // info
    const info = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = v.name;

    const meta = document.createElement('p');
    meta.className = 'muted';
    meta.textContent = `${v.type} • ${v.fuel}`;

    const price = document.createElement('p');
    price.innerHTML = `<strong>Rent/day:</strong> $${fmtMoney(v.price_per_day_rent)} &nbsp; | &nbsp; <strong>Buy:</strong> $${fmtMoney(v.price_buy)}`;

    // qty
    const qtyWrap = document.createElement('label');
    qtyWrap.textContent = 'Qty';
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '0';
    qtyInput.step = '1';
    qtyInput.value = qty;
    qtyInput.className = 'qty';
    qtyInput.addEventListener('input', () => {
      const val = Math.max(0, parseInt(qtyInput.value || '0', 10));
      state.quantities.set(v.id, val);
      updateTotals();
    });
    qtyWrap.appendChild(qtyInput);

    info.appendChild(title);
    info.appendChild(meta);
    info.appendChild(price);
    info.appendChild(qtyWrap);

    item.appendChild(img);
    item.appendChild(info);
    list.appendChild(item);
  });
}

function rentalDays() {
  const orderType = $('#order_type').value;
  if (orderType !== 'rent') return 1;

  const sd = $('#start_date').value ? new Date($('#start_date').value) : null;
  const ed = $('#end_date').value ? new Date($('#end_date').value) : null;
  if (!sd || !ed || isNaN(sd) || isNaN(ed)) return 1;

  const diffMs = ed - sd;
  if (diffMs <= 0) return 1;

  // ceil days
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function updateTotals() {
  const orderType = $('#order_type').value;
  const days = rentalDays();

  let subtotal = 0;
  state.vehicles.forEach(v => {
    const q = state.quantities.get(v.id) || 0;
    if (!q) return;

    const price = (orderType === 'buy') ? Number(v.price_buy) : Number(v.price_per_day_rent) * days;
    subtotal += price * q;
  });

  const totals = $('#totals');
  totals.innerHTML = `
    <p><strong>Order type:</strong> ${orderType === 'rent' ? 'Lease' : 'Purchase'}</p>
    ${orderType === 'rent' ? `<p><strong>Days:</strong> ${days}</p>` : ''}
    <p><strong>Subtotal:</strong> $${fmtMoney(subtotal)}</p>
  `;
}

// handle order type & dates affecting totals
$('#order_type').addEventListener('change', updateTotals);
$('#start_date').addEventListener('change', updateTotals);
$('#end_date').addEventListener('change', updateTotals);

// submit order
$('#leasingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const order_type = $('#order_type').value;
  const items = [];

  state.quantities.forEach((qty, id) => {
    if (qty > 0) items.push({ vehicle_id: id, quantity: qty });
  });

  if (!items.length) {
    showMsg('leaseMsg', 'Please select at least one vehicle (qty > 0).', true);
    return;
  }

  const payload = {
    customer_name: $('#customer_name').value.trim(),
    email: $('#email').value.trim(),
    phone: $('#phone').value.trim(),
    order_type,
    start_date: order_type === 'rent' ? $('#start_date').value || null : null,
    end_date: order_type === 'rent' ? $('#end_date').value || null : null,
    items
  };

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Order failed.');
    }

    showMsg('leaseMsg', `✅ Request submitted. Order #${data.orderId}. Total: $${fmtMoney(data.total)}${order_type === 'rent' ? ` for ${data.days} day(s)` : ''}.`, false);
    // reset selections
    state.quantities.clear();
    renderVehicles();
    updateTotals();
  } catch (err) {
    console.error(err);
    showMsg('leaseMsg', 'There was an error submitting your request. Please try again.', true);
  }
});

function showMsg(id, text, isError) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = isError ? 'error' : 'success';
}

// kick off
loadVehicles();
