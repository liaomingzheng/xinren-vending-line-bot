async function api(path, options = {}) {
  const timeout = options.timeout || 20000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      signal: controller.signal,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) throw new Error(data.message || '操作失敗');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('API 查詢逾時，請稍後再試');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function money(n) { return `$${Number(n || 0).toLocaleString('zh-TW')}`; }
function productImage(url) { return url ? `<img class="product-img" src="${escapeHtml(url)}" onerror="this.style.display='none'">` : `<div class="product-img placeholder">商品</div>`; }
function el(id) { return document.getElementById(id); }
function setHTML(id, html) { el(id).innerHTML = html; }
function escapeHtml(s='') { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function qs(name) { return new URLSearchParams(location.search).get(name); }
function currentPath() { return `${location.pathname}${location.search || ''}`; }
function goBack(fallback = '/') {
  const draft = JSON.parse(localStorage.getItem('xinren_order_draft') || '{}');
  const stored = localStorage.getItem('xinren_return_to') || draft.returnTo || fallback;
  if (document.referrer && document.referrer.includes(location.host) && history.length > 1) history.back();
  else location.href = stored || fallback;
}
function setReturnTo(path) { localStorage.setItem('xinren_return_to', path); }

const state = { machines: [], selectedMachine: null, products: [], cart: new Map(), map: null, markers: [] };

function cartCount() {
  return getCartItems().reduce((sum, item) => sum + Number(item.quantity || 1), 0);
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__xinrenToastTimer);
  window.__xinrenToastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}


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
  if (!items.length) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const count = cartCount();
  const first = items[0];
  const more = items.length > 1 ? ` 等 ${items.length} 種商品` : '';
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="cart-row">
      <div>
        <strong>已選 ${count} 件｜${escapeHtml(first.commodityName || '商品')}${more}</strong>
        <div class="muted">點「查看明細」可確認商品與數量</div>
      </div>
      <strong class="price">${money(cartTotal())}</strong>
    </div>
    <div class="cart-actions">
      <button class="btn block" onclick="openCartSheet()">查看明細</button>
      <button class="btn primary block" onclick="goConfirm('${nextHref || 'confirm.html'}')">前往結帳</button>
    </div>
  `;
}

function addToCart(item) {
  const key = item.commodityCode;
  const old = state.cart.get(key);
  const nextQty = old ? old.quantity + 1 : 1;
  state.cart.set(key, { ...item, quantity: nextQty });
  showToast(`已加入：${item.commodityName || '商品'} × ${nextQty}`);
  if (el('products')) renderProductList();
  else renderCart('confirm.html');
  if (document.getElementById('cartSheet')) renderCartSheetBody();
}

function removeFromCart(code) {
  const old = state.cart.get(code);
  if (!old) return;
  if (old.quantity <= 1) state.cart.delete(code);
  else state.cart.set(code, { ...old, quantity: old.quantity - 1 });
  if (el('products')) renderProductList();
  else renderCart('confirm.html');
  if (document.getElementById('cartSheet')) renderCartSheetBody();
}

function setCartQuantity(code, quantity) {
  const old = state.cart.get(code);
  if (!old) return;
  const qty = Number(quantity || 0);
  if (qty <= 0) state.cart.delete(code);
  else state.cart.set(code, { ...old, quantity: qty });
  if (el('products')) renderProductList();
  else renderCart('confirm.html');
  if (document.getElementById('cartSheet')) renderCartSheetBody();
}

function closeCartSheet() {
  const sheet = document.getElementById('cartSheet');
  if (sheet) sheet.remove();
}

function openCartSheet() {
  closeCartSheet();
  const wrap = document.createElement('div');
  wrap.id = 'cartSheet';
  wrap.className = 'cart-sheet-backdrop';
  wrap.innerHTML = `
    <div class="cart-sheet">
      <div class="cart-sheet-head">
        <div><strong>已選商品</strong><div class="muted">確認品項、數量與小計</div></div>
        <button class="sheet-close" onclick="closeCartSheet()">×</button>
      </div>
      <div id="cartSheetBody"></div>
    </div>
  `;
  wrap.addEventListener('click', (event) => { if (event.target === wrap) closeCartSheet(); });
  document.body.appendChild(wrap);
  renderCartSheetBody();
}

function renderCartSheetBody() {
  const body = document.getElementById('cartSheetBody');
  if (!body) return;
  const items = getCartItems();
  if (!items.length) {
    body.innerHTML = `<div class="notice">目前購物車沒有商品。</div><button class="btn block" onclick="closeCartSheet()">繼續選購</button>`;
    renderCart('confirm.html');
    return;
  }
  body.innerHTML = `
    <div class="cart-sheet-items">
      ${items.map(i => `
        <div class="cart-sheet-item">
          ${productImage(i.photoUrl)}
          <div class="product-main">
            <div class="row"><strong>${escapeHtml(i.commodityName)}</strong><strong>${money(Number(i.price||0)*Number(i.quantity||1))}</strong></div>
            <div class="muted">單價 ${money(i.price)}｜商品編號：${escapeHtml(i.commodityCode || '')}</div>
            <div class="qty qty-strong" style="margin-top:8px">
              <button onclick="setCartQuantity('${escapeHtml(i.commodityCode)}', ${Number(i.quantity||1)-1})">−</button>
              <span>${Number(i.quantity || 1)}</span>
              <button onclick="setCartQuantity('${escapeHtml(i.commodityCode)}', ${Number(i.quantity||1)+1})">＋</button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="cart-sheet-total"><span>小計</span><strong class="price">${money(cartTotal())}</strong></div>
    <div class="cart-actions">
      <button class="btn block" onclick="closeCartSheet()">繼續選購</button>
      <button class="btn primary block" onclick="goConfirm('confirm.html')">確認訂單</button>
    </div>
  `;
  renderCart('confirm.html');
}

function saveOrderDraft(returnTo = currentPath()) {
  const existing = JSON.parse(localStorage.getItem('xinren_order_draft') || '{}');
  const draft = { ...existing, machine: state.selectedMachine, items: getCartItems(), returnTo };
  localStorage.setItem('xinren_order_draft', JSON.stringify(draft));
  setReturnTo(returnTo);
}

function goConfirm() {
  saveOrderDraft(currentPath());
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
  try {
    const data = await api('/api/machines');
    state.machines = Array.isArray(data.machines) ? data.machines : (data.machines?.machine || []);
    initMap();
    renderMachines(state.machines);
    if (state.machines[0]) selectMachine(state.machines[0].code, false);
  } catch (error) {
    setHTML('machineList', `<div class="notice error">機台載入失敗：${escapeHtml(error.message)}</div>`);
  }
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
  try {
    const data = await api(`/api/machines/${encodeURIComponent(code)}/orderable-inventory`, { timeout: 20000 });
    state.products = data.items || [];
    renderProductList();
  } catch (error) {
    setHTML('products', `<div class="notice error">庫存載入失敗：${escapeHtml(error.message)}<br>請稍後再試，或改用其他機台。</div>`);
  }
}

function renderProductList() {
  const html = (state.products || []).map(p => {
    const inCart = state.cart.get(p.commodityCode)?.quantity || 0;
    return `
      <div class="product-card product-card-with-img">
        ${productImage(p.photoUrl)}
        <div class="product-main">
          <div class="row"><div><strong>${escapeHtml(p.commodityName)}</strong><div class="muted">${escapeHtml(p.commodityTypeName || p.brandName || p.commodityCode)}</div></div><div class="price">${money(p.price)}</div></div>
          <div class="muted">可預訂庫存：${p.quantity ?? '-'}　商品編號：${escapeHtml(p.commodityCode)}</div>
          <div class="row" style="margin-top:10px">
            <span class="selected-badge ${inCart ? '' : 'empty'}">${inCart ? `已選 × ${inCart}` : '尚未選擇'}</span>
            <div class="qty qty-strong">
              <button onclick="removeFromCart('${escapeHtml(p.commodityCode)}')" ${inCart ? '' : 'disabled'}>−</button>
              <span>${inCart || 0}</span>
              <button onclick='addToCart(${JSON.stringify({commodityCode:p.commodityCode, commodityName:p.commodityName, price:p.price, quantity:1, photoUrl:p.photoUrl}).replace(/'/g,"&#39;")})'>＋</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
  setHTML('products', html || '<div class="notice">這台目前沒有可預訂庫存</div>');
  renderCart('confirm.html');
}

async function initProductPage() {
  setHTML('productList', '<div class="loader">逐台查詢可預訂庫存中，請稍候...</div>');
  try {
    const data = await api('/api/products/availability', { timeout: 30000 });
    const grouped = new Map();
    (data.items || []).forEach(x => {
      const key = x.commodityCode;
      const old = grouped.get(key) || { ...x, total: 0, machines: [] };
      old.total += Number(x.quantity || 0);
      old.machines.push(x.machine);
      grouped.set(key, old);
    });
    state.products = Array.from(grouped.values()).sort((a,b)=>String(a.commodityName).localeCompare(String(b.commodityName), 'zh-Hant'));
    renderProductChoices(data.failed || []);
  } catch (error) {
    setHTML('productList', `<div class="notice error">商品庫存載入失敗：${escapeHtml(error.message)}<br>建議先使用「照設備訂購」。</div><a class="btn primary block" href="/order-by-machine.html">改用照設備訂購</a>`);
  }
}

function renderProductChoices(failed = []) {
  const warning = failed.length ? `<div class="notice">部分機台查詢失敗 ${failed.length} 台，但已先顯示可查到的商品。</div>` : '';
  setHTML('productList', warning + (state.products.map(p => `
    <div class="product-card product-card-with-img" onclick="showMachinesForProduct('${escapeHtml(p.commodityCode)}')">
      ${productImage(p.photoUrl)}
      <div class="product-main">
        <div class="row"><strong>${escapeHtml(p.commodityName)}</strong><span class="price">${money(p.price)}</span></div>
        <div class="muted">總可預訂：${p.total}　有貨設備：${p.machines.length} 台</div>
        <button class="btn primary" style="margin-top:10px">查看有貨設備</button>
      </div>
    </div>
  `).join('') || '<div class="notice">目前沒有商品資料</div>'));
}

async function showMachinesForProduct(commodityCode) {
  setHTML('productList', '<div class="loader">查詢有貨設備中...</div>');
  let data;
  try {
    data = await api(`/api/products/availability?commodityCode=${encodeURIComponent(commodityCode)}`, { timeout: 30000 });
  } catch (error) {
    setHTML('productList', `<div class="notice error">查詢有貨設備失敗：${escapeHtml(error.message)}</div>`);
    return;
  }
  const product = data.items[0];
  if (!product) { setHTML('productList', '<div class="notice">目前沒有設備有這項商品。</div>'); return; }
  state.products = [{ commodityCode: product.commodityCode, commodityName: product.commodityName, price: product.price, quantity: 1, photoUrl: product.photoUrl }];
  const machineCards = (data.items || []).map(x => `
    <div class="machine-card" onclick='selectProductMachine(${JSON.stringify(x).replace(/'/g,"&#39;")})'>
      <div class="row"><strong>${escapeHtml(x.machine.name)}</strong><span class="pill">庫存 ${x.quantity}</span></div>
      <div class="muted">${escapeHtml(x.machine.address || '')}</div>
      <button class="btn primary" style="margin-top:10px">選這台購買</button>
    </div>
  `).join('');
  setHTML('productList', `<div class="card product-card-with-img">${productImage(product.photoUrl)}<div class="product-main"><h3>${escapeHtml(product.commodityName)}</h3><div class="muted">請選擇要前往的販賣機</div><div class="price">${money(product.price)}</div></div></div>${machineCards}`);
}

function selectProductMachine(x) {
  state.selectedMachine = x.machine;
  state.cart.clear();
  addToCart({ commodityCode: x.commodityCode, commodityName: x.commodityName, price: x.price, quantity: 1, photoUrl: x.photoUrl });
  saveOrderDraft('/order-by-product.html');
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
      ${draft.items.map(i => `<div class="order-item">${productImage(i.photoUrl)}<div class="product-main"><div class="row"><span>${escapeHtml(i.commodityName)} × ${i.quantity}</span><strong>${money(Number(i.price||0)*Number(i.quantity||1))}</strong></div><div class="muted">商品編號：${escapeHtml(i.commodityCode || '')}</div></div></div>`).join('')}
      <hr style="border:0;border-top:1px solid #e5e7eb;margin:12px 0">
      <div class="row"><strong>總金額</strong><strong class="price">${money(total)}</strong></div>
    </div>
    <button class="btn block" onclick="location.href='${escapeHtml(draft.returnTo || '/order-by-machine.html')}'">回上一步修改商品</button>
    <div class="notice" style="margin-top:10px">按下「準備訂購」後，系統會先鎖定商品；付款等待時間為 15 分鐘，QRC 領取期限為當日 23:59:59。</div>
    <button class="btn primary block" style="margin-top:12px" onclick="lockOrder()">準備訂購</button>
  `);
}

async function lockOrder() {
  const draft = JSON.parse(localStorage.getItem('xinren_order_draft') || '{}');
  if (!draft.machine?.code || !draft.items?.length) {
    setHTML('confirmBox', '<div class="notice error">訂單資料不完整，請重新選擇商品。</div><a class="btn primary block" href="/order-by-machine.html">回到訂購</a>');
    return;
  }
  setHTML('confirmBox', '<div class="loader">建立預訂鎖定中...</div><div class="notice">正在向天來 API 鎖定商品，若連線不穩系統會自動重試，請稍候。</div>');
  try {
    const data = await api('/api/orders/lock', {
      method: 'POST',
      timeout: 45000,
      body: { machineCode: draft.machine.code, items: draft.items }
    });
    localStorage.setItem('xinren_last_order_id', data.order.id);
    location.href = `/payment.html?id=${encodeURIComponent(data.order.id)}`;
  } catch (error) {
    setHTML('confirmBox', `
      <div class="notice error">建立預訂失敗：${escapeHtml(error.message)}</div>
      <div class="card">
        <h3>${escapeHtml(draft.machine.name || draft.machine.code)}</h3>
        <div class="muted">機台編號：${escapeHtml(draft.machine.code)}</div>
        ${draft.items.map(i => `<div class="row"><span>${escapeHtml(i.commodityName)} × ${i.quantity}</span><strong>${money(Number(i.price||0)*Number(i.quantity||1))}</strong></div>`).join('')}
      </div>
      <button class="btn primary block" onclick="lockOrder()">重新建立預訂</button>
      <a class="btn block" style="margin-top:10px" href="/order-by-machine.html">回到機台重新選擇</a>
    `);
  }
}

async function initPayment() {
  const id = qs('id') || localStorage.getItem('xinren_last_order_id');
  try {
    const data = await api(`/api/orders/${encodeURIComponent(id)}`);
    const order = data.order;
    setHTML('paymentBox', `
      <div class="card"><h3>等待付款</h3><p>請在 <strong>15 分鐘內</strong> 完成付款。付款完成後，QRC 領取期限為 <strong>當日 23:59:59</strong>。</p></div>
      <div class="card">
        <div class="row"><span>訂單編號</span><strong>${escapeHtml(order.id)}</strong></div>
        <div class="row"><span>付款金額</span><strong class="price">${money(order.amount)}</strong></div>
        <div class="row"><span>付款方式</span><strong>模擬付款</strong></div>
      </div>
      <button class="btn green block" onclick="mockPay('${escapeHtml(order.id)}')">模擬付款完成</button>
      <a class="btn block" style="margin-top:10px" href="/confirm.html">回確認訂單</a>
      <button class="btn danger block" style="margin-top:10px" onclick="cancelOrder('${escapeHtml(order.id)}')">取消預訂</button>
    `);
  } catch (error) {
    setHTML('paymentBox', `<div class="notice error">付款頁載入失敗：${escapeHtml(error.message)}</div><a class="btn primary block" href="/order-by-machine.html">重新訂購</a>`);
  }
}

async function mockPay(id) {
  setHTML('paymentBox', '<div class="loader">確認付款並啟用條碼中...</div>');
  try {
    const data = await api(`/api/orders/${encodeURIComponent(id)}/mock-pay`, { method: 'POST', timeout: 45000, body: {} });
    location.href = `/qrcode.html?id=${encodeURIComponent(data.order.id)}`;
  } catch (error) {
    setHTML('paymentBox', `<div class="notice error">付款確認失敗：${escapeHtml(error.message)}</div><button class="btn green block" onclick="mockPay('${escapeHtml(id)}')">重新確認付款</button>`);
  }
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
      ${o.items.map(i => `<div class="order-item">${productImage(i.photoUrl)}<div class="product-main"><div class="row"><span>${escapeHtml(i.commodityName)} × ${i.quantity}</span><strong>${money(Number(i.price||0)*Number(i.quantity||1))}</strong></div><div class="muted">商品編號：${escapeHtml(i.commodityCode || '')}</div></div></div>`).join('')}
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
      ${(o.items || []).map(i => `<div class="order-item compact">${productImage(i.photoUrl)}<div class="product-main"><div>${escapeHtml(i.commodityName)} × ${i.quantity}</div><div class="muted">${money(Number(i.price||0)*Number(i.quantity||1))}</div></div></div>`).join('')}
      ${o.status === 'ACTIVE' ? `<a class="btn primary" style="margin-top:10px" href="/qrcode.html?id=${encodeURIComponent(o.id)}">查看 QRC</a>` : ''}
    </div>
  `).join('');
  setHTML('ordersBox', localHtml || '<div class="notice">目前本機暫存沒有訂單。正式查詢可使用天來交易/預訂查詢 API。</div>');
}
