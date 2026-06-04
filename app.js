async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.message || '操作失敗');
  return data;
}

function money(n) { return `$${Number(n || 0).toLocaleString('zh-TW')}`; }
function el(id) { return document.getElementById(id); }
function setHTML(id, html) { el(id).innerHTML = html; }
function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function qs(name) { return new URLSearchParams(location.search).get(name); }

const state = { machines: [], selectedMachine: null, products: [], cart: new Map(), map: null, markers: [] };

function getCartItems() {
  return Array.from(state.cart.values());
}

function cartTotal() {
  return getCartItems().reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0);
}

function renderCart(nextHref) {
  const items = getCartItems();
  const box = el('cart');
  if (!box) return;
  if (!items.length) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="cart-row"><strong>已選 ${items.reduce((a,b)=>a+Number(b.quantity||1),0)} 件</strong><strong class="price">${money(cartTotal())}</strong></div>
    <button class="btn primary block" onclick="goConfirm('${nextHref || 'confirm.html'}')">前往結帳</button>
  `;
}

function addToCart(item) {
  const key = item.commodityCode;
  const old = state.cart.get(key);
  state.cart.set(key, { ...item, quantity: old ? old.quantity + 1 : 1 });
  renderCart('confirm.html');
}

function removeFromCart(code) {
  const old = state.cart.get(code);
  if (!old) return;
  if (old.quantity <= 1) state.cart.delete(code);
  else state.cart.set(code, { ...old, quantity: old.quantity - 1 });
  renderProductList();
  renderCart('confirm.html');
}

function saveOrderDraft() {
  localStorage.setItem('xinren_order_draft', JSON.stringify({ machine: state.selectedMachine, items: getCartItems() }));
}

function goConfirm() {
  saveOrderDraft();
  location.href = '/confirm.html';
}

async function initHome() {
  try {
    const cfg = await api('/api/config');
    el('apiStatus').textContent = cfg.hasTenlifeCredentials ? 'Tenlife API：已設定' : 'Tenlife API：尚未設定，現在使用展示資料';
  } catch (e) {}
}

async function initMachinePage() {
  setHTML('machineList', '<div class="loader">載入機台中...</div>');
  const data = await api('/api/machines');
  state.machines = data.machines || [];
  initMap();
  renderMachines(state.machines);
  if (state.machines[0]) selectMachine(state.machines[0].code, false);
}

function initMap() {
  const mapEl = el('map');
  if (!mapEl || typeof L === 'undefined') return;
  state.map = L.map('map', { zoomControl: false }).setView([23.5, 120.6], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(state.map);
}

function renderMachines(machines) {
  const list = machines.map(m => `
    <div class="machine-card ${state.selectedMachine?.code === m.code ? 'selected' : ''}" onclick="selectMachine('${escapeHtml(m.code)}')">
      <div class="row"><strong>${escapeHtml(m.name || m.code)}</strong><span class="pill">${escapeHtml(m.area || '據點')}</span></div>
      <div class="muted">${escapeHtml(m.address || '')}</div>
      <div class="muted">機台編號：${escapeHtml(m.code)}</div>
      <div style="margin-top:8px" class="row">
        <a class="btn" onclick="event.stopPropagation()" href="${escapeHtml(m.mapUrl || '#')}" target="_blank">導航</a>
        <button class="btn primary" onclick="event.stopPropagation();selectMachine('${escapeHtml(m.code)}');document.getElementById('products').scrollIntoView({behavior:'smooth'})">選這台</button>
      </div>
    </div>
  `).join('');
  setHTML('machineList', list || '<div class="notice">目前沒有機台資料</div>');
  renderMapMarkers(machines);
}

function renderMapMarkers(machines) {
  if (!state.map) return;
  state.markers.forEach(m => m.remove());
  state.markers = [];
  const bounds = [];
  machines.forEach(m => {
    if (!m.lat || !m.lng) return;
    const icon = L.divIcon({ className: '', html: '<div class="vending-marker">販</div>', iconSize: [34,34], iconAnchor: [17,17] });
    const marker = L.marker([m.lat, m.lng], { icon }).addTo(state.map)
      .bindPopup(`<strong>${escapeHtml(m.name || m.code)}</strong><br>${escapeHtml(m.address || '')}<br><button onclick="selectMachine('${escapeHtml(m.code)}')">選擇這台</button>`)
      .on('click', () => selectMachine(m.code, false));
    state.markers.push(marker);
    bounds.push([m.lat, m.lng]);
  });
  if (bounds.length) state.map.fitBounds(bounds, { padding: [30,30] });
}

async function selectMachine(code, scroll = true) {
  state.selectedMachine = state.machines.find(m => m.code === code);
  renderMachines(state.machines);
  if (state.map && state.selectedMachine?.lat) state.map.setView([state.selectedMachine.lat, state.selectedMachine.lng], 16);
  setHTML('selectedMachine', state.selectedMachine ? `已選：<strong>${escapeHtml(state.selectedMachine.name)}</strong><br><span class="muted">${escapeHtml(state.selectedMachine.address)}</span>` : '');
  await loadMachineInventory(code);
  if (scroll) el('products').scrollIntoView({ behavior: 'smooth' });
}

async function loadMachineInventory(code) {
  setHTML('products', '<div class="loader">查詢庫存 API 中...</div>');
  const data = await api(`/api/machines/${encodeURIComponent(code)}/inventory`);
  state.products = data.items || [];
  renderProductList();
}

function renderProductList() {
  const html = (state.products || []).map(p => {
    const inCart = state.cart.get(p.commodityCode)?.quantity || 0;
    return `
      <div class="product-card">
        <div class="row"><div><strong>${escapeHtml(p.commodityName)}</strong><div class="muted">${escapeHtml(p.commodityTypeName || p.brandName || p.commodityCode)}</div></div><div class="price">${money(p.price)}</div></div>
        <div class="muted">可預訂庫存：${p.quantity ?? '-'}　商品編號：${escapeHtml(p.commodityCode)}</div>
        <div class="row" style="margin-top:10px">
          <span>${inCart ? `已選 ${inCart}` : ''}</span>
          <div class="qty">
            <button onclick="removeFromCart('${escapeHtml(p.commodityCode)}')">−</button>
            <button onclick='addToCart(${JSON.stringify({commodityCode:p.commodityCode, commodityName:p.commodityName, price:p.price, quantity:1}).replace(/'/g,"&#39;")})'>＋</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  setHTML('products', html || '<div class="notice">這台目前沒有可預訂庫存</div>');
  renderCart('confirm.html');
}

async function initProductPage() {
  setHTML('productList', '<div class="loader">查詢全部庫存 API 中...</div>');
  const data = await api('/api/products/availability');
  const grouped = new Map();
  (data.items || []).forEach(x => {
    const key = x.commodityCode;
    const old = grouped.get(key) || { ...x, total: 0, machines: [] };
    old.total += Number(x.quantity || 0);
    old.machines.push(x.machine);
    grouped.set(key, old);
  });
  state.products = Array.from(grouped.values());
  renderProductChoices();
}

function renderProductChoices() {
  setHTML('productList', state.products.map(p => `
    <div class="product-card" onclick="showMachinesForProduct('${escapeHtml(p.commodityCode)}')">
      <div class="row"><strong>${escapeHtml(p.commodityName)}</strong><span class="price">${money(p.price)}</span></div>
      <div class="muted">總可預訂：${p.total}　有貨設備：${p.machines.length} 台</div>
      <button class="btn primary" style="margin-top:10px">查看有貨設備</button>
    </div>
  `).join('') || '<div class="notice">目前沒有商品資料</div>');
}

async function showMachinesForProduct(commodityCode) {
  const data = await api(`/api/products/availability?commodityCode=${encodeURIComponent(commodityCode)}`);
  const product = data.items[0];
  if (!product) return;
  state.products = [{ commodityCode: product.commodityCode, commodityName: product.commodityName, price: product.price, quantity: 1 }];
  const machineCards = (data.items || []).map(x => `
    <div class="machine-card" onclick='selectProductMachine(${JSON.stringify(x).replace(/'/g,"&#39;")})'>
      <div class="row"><strong>${escapeHtml(x.machine.name)}</strong><span class="pill">庫存 ${x.quantity}</span></div>
      <div class="muted">${escapeHtml(x.machine.address || '')}</div>
      <button class="btn primary" style="margin-top:10px">選這台購買</button>
    </div>
  `).join('');
  setHTML('productList', `<div class="card"><h3>${escapeHtml(product.commodityName)}</h3><div class="muted">請選擇要前往的販賣機</div></div>${machineCards}`);
}

function selectProductMachine(x) {
  state.selectedMachine = x.machine;
  state.cart.clear();
  addToCart({ commodityCode: x.commodityCode, commodityName: x.commodityName, price: x.price, quantity: 1 });
  saveOrderDraft();
  location.href = '/confirm.html';
}

async function initConfirm() {
  const draft = JSON.parse(localStorage.getItem('xinren_order_draft') || '{}');
  if (!draft.machine || !draft.items?.length) {
    setHTML('confirmBox', '<div class="notice">沒有訂單資料，請重新選擇商品。</div><a class="btn primary block" href="/order-by-machine.html">回到訂購</a>');
    return;
  }
  const total = draft.items.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 1), 0);
  setHTML('confirmBox', `
    <div class="card">
      <h3>${escapeHtml(draft.machine.name)}</h3>
      <div class="muted">機台編號：${escapeHtml(draft.machine.code)}</div>
      <div class="muted">${escapeHtml(draft.machine.address || '')}</div>
    </div>
    <div class="card">
      <h3>商品明細</h3>
      ${draft.items.map(i => `<div class="row"><span>${escapeHtml(i.commodityName)} × ${i.quantity}</span><strong>${money(Number(i.price||0)*Number(i.quantity||1))}</strong></div>`).join('')}
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:12px 0">
      <div class="row"><strong>總金額</strong><strong class="price">${money(total)}</strong></div>
    </div>
    <div class="notice">按下「準備訂購」後，系統會先呼叫天來即時預訂鎖定 API，保留 15 分鐘等待付款。</div>
    <button class="btn primary block" style="margin-top:12px" onclick="lockOrder()">準備訂購</button>
  `);
}

async function lockOrder() {
  const draft = JSON.parse(localStorage.getItem('xinren_order_draft') || '{}');
  setHTML('confirmBox', '<div class="loader">建立預訂鎖定中...</div>');
  const data = await api('/api/orders/lock', { method: 'POST', body: { machineCode: draft.machine.code, items: draft.items } });
  localStorage.setItem('xinren_last_order_id', data.order.id);
  location.href = `/payment.html?id=${encodeURIComponent(data.order.id)}`;
}

async function initPayment() {
  const id = qs('id') || localStorage.getItem('xinren_last_order_id');
  const data = await api(`/api/orders/${encodeURIComponent(id)}`);
  const order = data.order;
  setHTML('paymentBox', `
    <div class="card"><h3>等待付款</h3><p>請在 <strong>15 分鐘內</strong> 完成付款，逾時預訂會失效。</p></div>
    <div class="card">
      <div class="row"><span>訂單編號</span><strong>${escapeHtml(order.id)}</strong></div>
      <div class="row"><span>付款金額</span><strong class="price">${money(order.amount)}</strong></div>
      <div class="row"><span>付款方式</span><strong>模擬付款</strong></div>
    </div>
    <button class="btn green block" onclick="mockPay('${escapeHtml(order.id)}')">模擬付款完成</button>
    <button class="btn danger block" style="margin-top:10px" onclick="cancelOrder('${escapeHtml(order.id)}')">取消預訂</button>
  `);
}

async function mockPay(id) {
  setHTML('paymentBox', '<div class="loader">確認付款並啟用條碼中...</div>');
  const data = await api(`/api/orders/${encodeURIComponent(id)}/mock-pay`, { method: 'POST', body: {} });
  location.href = `/qrcode.html?id=${encodeURIComponent(data.order.id)}`;
}

async function cancelOrder(id) {
  await api(`/api/orders/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: {} });
  alert('已取消預訂');
  location.href = '/';
}

async function initQr() {
  const id = qs('id') || localStorage.getItem('xinren_last_order_id');
  const data = await api(`/api/orders/${encodeURIComponent(id)}`);
  const o = data.order;
  setHTML('qrBox', `
    <div class="success"><strong>訂購完成！</strong><br>請前往指定販賣機掃描下方 QRC 領取商品。</div>
    <div class="card">
      <h3>${escapeHtml(o.machine.name)}</h3>
      <div class="muted">${escapeHtml(o.machine.address || '')}</div>
      ${o.items.map(i => `<div class="row"><span>${escapeHtml(i.commodityName)} × ${i.quantity}</span><strong>${money(Number(i.price||0)*Number(i.quantity||1))}</strong></div>`).join('')}
      <img class="qr" src="${o.qrDataUrl}" alt="QRC 領取碼">
      <div class="muted">領取碼：${escapeHtml(o.id)}</div>
      <div class="muted">領取期限：${escapeHtml(o.shelflife)}</div>
    </div>
    <a class="btn primary block" href="${escapeHtml(o.machine.mapUrl || '#')}" target="_blank">導航到這台販賣機</a>
    <a class="btn block" style="margin-top:10px" href="/orders.html">查詢訂單</a>
  `);
}

async function initOrders() {
  const local = await api('/api/orders');
  const localHtml = (local.orders || []).map(o => `
    <div class="card">
      <div class="row"><strong>${escapeHtml(o.machine?.name || '')}</strong><span class="pill">${escapeHtml(o.status)}</span></div>
      <div class="muted">訂單：${escapeHtml(o.id)}</div>
      <div class="muted">建立：${new Date(o.createdAt).toLocaleString('zh-TW')}</div>
      ${o.status === 'ACTIVE' ? `<a class="btn primary" style="margin-top:10px" href="/qrcode.html?id=${encodeURIComponent(o.id)}">查看 QRC</a>` : ''}
    </div>
  `).join('');
  setHTML('ordersBox', localHtml || '<div class="notice">目前本機暫存沒有訂單。正式查詢可使用天來交易/預訂查詢 API。</div>');
}
