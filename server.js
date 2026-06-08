require('dotenv').config();

const path = require('path');
const express = require('express');
const line = require('@line/bot-sdk');
const QRCode = require('qrcode');
const tenlife = require('./services/tenlifeApi');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  }
}));

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'dummy'
};

const lineClient = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'dummy'
});

const pendingOrders = new Map();

function adminRecipients() {
  return (process.env.ADMIN_LINE_USER_ID || process.env.ADMIN_LINE_TO || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function shortOrderId(id) {
  return String(id || '').slice(0, 8);
}

function orderSummaryText(order, statusText) {
  const itemsText = (order.items || []).map((item) => `- ${item.commodityName || item.commodityCode} × ${item.quantity || 1}｜$${Number(item.price || 0)}`).join('\n');
  return [
    `新刃智能販賣機訂單通知`,
    `狀態：${statusText}`,
    `訂單：${order.id}`,
    `機台：${order.machine?.name || order.machine?.code || ''}`,
    `機台編號：${order.machine?.code || ''}`,
    `金額：$${Number(order.amount || 0)}`,
    `商品：`,
    itemsText || '- 無商品資料',
    order.shelflife ? `領取期限：${order.shelflife}` : '',
    `建立時間：${new Date(order.createdAt || Date.now()).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`
  ].filter(Boolean).join('\n');
}

async function notifyAdminOrder(order, statusText) {
  const recipients = adminRecipients();
  if (!recipients.length || !process.env.LINE_CHANNEL_ACCESS_TOKEN || process.env.LINE_CHANNEL_ACCESS_TOKEN === 'dummy') return;
  const text = orderSummaryText(order, statusText);
  await Promise.allSettled(recipients.map((to) => lineClient.pushMessage({ to, messages: [textMessage(text)] })));
}

function appBase(req) {
  return process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function safeAsync(fn) {
  return async (req, res) => {
    try { await fn(req, res); } catch (error) {
      console.error(error);
      res.status(500).json({ ok: false, message: error.message || 'Server error' });
    }
  };
}

function textMessage(text) {
  return { type: 'text', text };
}

function flexEntry(baseUrl) {
  return {
    type: 'flex',
    altText: '新刃智能販賣機商城',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0F766E',
        paddingAll: '18px',
        contents: [
          { type: 'text', text: '新刃智能販賣機商城', weight: 'bold', color: '#FFFFFF', size: 'xl' },
          { type: 'text', text: '照設備 / 照商品訂購', color: '#D1FAE5', size: 'sm', margin: 'sm' }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'button', style: 'primary', color: '#2563EB', action: { type: 'uri', label: '照設備訂購', uri: `${baseUrl}/order-by-machine.html` } },
          { type: 'button', style: 'primary', color: '#16A34A', action: { type: 'uri', label: '照商品訂購', uri: `${baseUrl}/order-by-product.html` } },
          { type: 'button', action: { type: 'uri', label: '查詢訂單 / 領取狀態', uri: `${baseUrl}/orders.html` } },
          { type: 'button', action: { type: 'uri', label: '操作說明', uri: `${baseUrl}/guide.html` } }
        ]
      }
    }
  };
}

async function handleLineEvent(event, req) {
  if (event.type === 'follow') {
    const baseUrl = appBase(req);
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [textMessage('歡迎來到新刃智能販賣機商城，請選擇訂購方式。'), flexEntry(baseUrl)]
    });
  }

  if (event.type !== 'message' || event.message.type !== 'text') return null;
  const text = event.message.text.trim();
  const baseUrl = appBase(req);

  if (/訂購|照設備|照商品|商城|購買|買|下單/.test(text)) {
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [flexEntry(baseUrl)] });
  }
  if (/據點|設備|機台|地圖/.test(text)) {
    return lineClient.replyMessage({
      replyToken: event.replyToken,
      messages: [
        textMessage('請開啟機台地圖，選擇你要前往的販賣機。'),
        { type: 'template', altText: '機台地圖', template: { type: 'buttons', title: '機台地圖', text: '像租車據點一樣選擇販賣機', actions: [
          { type: 'uri', label: '開啟機台地圖', uri: `${baseUrl}/order-by-machine.html` },
          { type: 'uri', label: '查詢訂單', uri: `${baseUrl}/orders.html` }
        ] } }
      ]
    });
  }
  return lineClient.replyMessage({ replyToken: event.replyToken, messages: [flexEntry(baseUrl)] });
}

app.get('/', (req, res) => {
  res.send('新刃智能販賣機商城 V6 Tenlife API 串接版 is running.');
});

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  try {
    await Promise.all((req.body.events || []).map((event) => handleLineEvent(event, req)));
    res.status(200).end();
  } catch (error) {
    console.error('LINE webhook error:', error);
    res.status(500).end();
  }
});

app.get('/api/config', (req, res) => {
  res.json({ ok: true, hasTenlifeCredentials: tenlife.hasCredentials(), appBaseUrl: appBase(req), paymentMode: process.env.PAYMENT_MODE || 'mock', hasAdminNotify: adminRecipients().length > 0 });
});

app.get('/api/machines', safeAsync(async (req, res) => {
  const machines = await tenlife.listMachines();
  res.json({ ok: true, machines });
}));

app.get('/api/machines/:code/state', safeAsync(async (req, res) => {
  const data = await tenlife.machineState(req.params.code);
  res.json({ ok: data.state === 0, ...data });
}));

app.get('/api/commodities', safeAsync(async (req, res) => {
  const data = await tenlife.commodities({ commodityCode: req.query.commodityCode, commodityID: req.query.commodityID });
  res.json({ ok: data.state === 0, ...data });
}));


const commodityCache = { time: 0, data: null };

function withTimeout(promise, ms, label = 'API timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}

function photoUrl(photo) {
  if (!photo) return '';
  const value = String(photo).trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const base = (process.env.TENLIFE_IMAGE_BASE || '').replace(/\/$/, '');
  return base ? `${base}/${encodeURIComponent(value)}` : '';
}

async function getCommodityMap() {
  const now = Date.now();
  if (commodityCache.data && now - commodityCache.time < 120000) return commodityCache.data;
  const commodityData = await tenlife.commodities();
  const map = new Map((commodityData.commodity || []).map((p) => [String(p.commodityCode), p]));
  commodityCache.time = now;
  commodityCache.data = map;
  return map;
}

function normalizeInventoryItems(rows, productMap) {
  return (rows || []).map((row) => {
    const product = productMap.get(String(row.commodityCode)) || {};
    const photo = product.bigPhoto || product.photo || row.bigPhoto || row.photo || '';
    return {
      ...row,
      commodityName: product.commodityName || row.commodityName || row.commodityCode,
      commodityTypeName: product.commodityTypeName || row.commodityTypeName || '',
      brandName: product.brandName || row.brandName || '',
      price: Number(product.price || row.price || 0),
      photo: photo,
      photoUrl: photoUrl(photo),
      info1: product.info1 || row.info1 || ''
    };
  }).filter((x) => Number(x.quantity || 0) > 0);
}

app.get('/api/machines/:code/inventory', safeAsync(async (req, res) => {
  const [available, productMap] = await Promise.all([
    withTimeout(tenlife.orderMachineCommodity(req.params.code), 12000, '查詢單台庫存逾時'),
    getCommodityMap()
  ]);
  const items = normalizeInventoryItems(available.commodity || [], productMap);
  res.json({ ok: available.state === 0, message: available.message || '', items, raw: available });
}));

app.get('/api/machines/:code/orderable-inventory', safeAsync(async (req, res) => {
  const [available, productMap] = await Promise.all([
    withTimeout(tenlife.orderMachineCommodity(req.params.code), 12000, '查詢單台可預訂庫存逾時'),
    getCommodityMap()
  ]);
  const items = normalizeInventoryItems(available.commodity || [], productMap);
  res.json({ ok: available.state === 0, code: req.params.code, message: available.message || '', items, raw: available });
}));

app.get('/api/products/availability', safeAsync(async (req, res) => {
  const machines = await tenlife.listMachines();
  const productMap = await getCommodityMap();
  const onlyCode = req.query.commodityCode ? String(req.query.commodityCode) : '';
  const timeoutMs = Number(req.query.timeout || 10000);
  const all = [];
  const failed = [];

  const tasks = machines.map(async (machine) => {
    try {
      const inv = await withTimeout(tenlife.orderMachineCommodity(machine.code), timeoutMs, `機台 ${machine.code} 查詢逾時`);
      if (inv.state !== 0) {
        failed.push({ code: machine.code, name: machine.name, message: inv.message || '查詢失敗' });
        return;
      }
      const items = normalizeInventoryItems(inv.commodity || [], productMap);
      for (const item of items) {
        if (onlyCode && String(item.commodityCode) !== onlyCode) continue;
        all.push({ ...item, machine });
      }
    } catch (error) {
      failed.push({ code: machine.code, name: machine.name, message: error.message });
    }
  });

  await Promise.allSettled(tasks);
  res.json({ ok: true, items: all, machinesChecked: machines.length, failed });
}));

app.post('/api/orders/lock', safeAsync(async (req, res) => {
  const { machineCode, items } = req.body || {};
  if (!machineCode) return res.status(400).json({ ok: false, message: '缺少 machineCode' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ ok: false, message: '缺少商品 items' });

  const shelflife = formatDateTime(addMinutes(new Date(), 15));
  const commodity = items.map((item) => ({
    commodityCode: String(item.commodityCode || '').trim(),
    quantity: Number(item.quantity || 1),
    price: ''
  })).filter((item) => item.commodityCode && item.quantity > 0);

  if (!commodity.length) return res.status(400).json({ ok: false, message: '商品資料缺少 commodityCode' });

  let result;
  try {
    if (process.env.MOCK_LOCK_ONLY === 'true') {
      result = { state: 0, message: '', id: `MOCK-${Date.now()}` };
    } else {
      result = await tenlife.lockOrder({ code: machineCode, shelflife, commodity });
    }
  } catch (error) {
    console.error('OrderLockCommodity error:', {
      message: error.message,
      machineCode,
      shelflife,
      commodity
    });
    return res.status(502).json({
      ok: false,
      message: `建立預訂鎖定失敗：${error.message}`,
      hint: '若 Render Logs 顯示 ECONNRESET，通常是天來 API 連線中斷；V6.2 已自動重試，仍失敗時請稍後再試或請設備商確認 OrderLockCommodity.aspx 連線。'
    });
  }

  if (result.state !== 0) {
    console.error('OrderLockCommodity rejected:', { result, machineCode, shelflife, commodity });
    return res.status(400).json({ ok: false, message: result.message || '預訂鎖定失敗', raw: result });
  }

  const machines = await tenlife.listMachines().catch(() => []);
  const machine = machines.find((m) => m.code === machineCode) || { code: machineCode, name: machineCode };
  const localOrder = {
    id: result.id,
    machine,
    items,
    amount: items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0),
    status: 'WAITING_PAYMENT',
    shelflife,
    createdAt: new Date().toISOString(),
    qrDataUrl: null
  };
  pendingOrders.set(result.id, localOrder);
  notifyAdminOrder(localOrder, '已建立預訂，等待付款').catch((error) => console.error('admin notify lock error:', error));
  res.json({ ok: true, order: localOrder, raw: result });
}));

app.post('/api/orders/:id/mock-pay', safeAsync(async (req, res) => {
  const order = pendingOrders.get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: '找不到訂單，可能服務重啟或訂單已過期' });
  const confirm = process.env.MOCK_LOCK_ONLY === 'true'
    ? { state: 0, message: '' }
    : await tenlife.createOrder(req.params.id);
  if (confirm.state !== 0) return res.status(400).json({ ok: false, message: confirm.message || '訂單生效失敗', raw: confirm });
  order.status = 'ACTIVE';
  order.paidAt = new Date().toISOString();
  order.qrDataUrl = await QRCode.toDataURL(req.params.id, { margin: 1, width: 260 });
  pendingOrders.set(order.id, order);
  notifyAdminOrder(order, '付款完成，訂單已生效').catch((error) => console.error('admin notify paid error:', error));
  res.json({ ok: true, order, raw: confirm });
}));

app.post('/api/orders/:id/cancel', safeAsync(async (req, res) => {
  const result = await tenlife.unlockOrder(req.params.id);
  const order = pendingOrders.get(req.params.id);
  if (order) {
    order.status = 'CANCELLED';
    pendingOrders.set(order.id, order);
  }
  res.json({ ok: result.state === 0, message: result.message || '', order, raw: result });
}));

app.get('/api/orders/:id', safeAsync(async (req, res) => {
  const order = pendingOrders.get(req.params.id);
  if (!order) return res.status(404).json({ ok: false, message: '找不到本機暫存訂單，請用交易查詢確認領取狀態' });
  res.json({ ok: true, order });
}));

app.get('/api/orders', safeAsync(async (req, res) => {
  res.json({ ok: true, orders: Array.from(pendingOrders.values()).sort((a,b) => b.createdAt.localeCompare(a.createdAt)) });
}));

app.get('/api/tenlife/active-orders', safeAsync(async (req, res) => {
  const data = await tenlife.activeOrders(req.query.code);
  res.json({ ok: data.state === 0, ...data });
}));

app.get('/api/tenlife/order-list', safeAsync(async (req, res) => {
  const now = new Date();
  const begin = req.query.begin || formatDate(new Date(now.getTime() - 30 * 86400000));
  const end = req.query.end || formatDate(now);
  const data = await tenlife.orderList({ begin, end, code: req.query.code, future: req.query.future || 1 });
  res.json({ ok: data.state === 0, ...data });
}));

app.get('/api/tenlife/sales', safeAsync(async (req, res) => {
  const data = await tenlife.sales(req.query);
  res.json({ ok: data.state === 0, ...data });
}));

app.listen(port, () => {
  console.log(`新刃智能販賣機商城 V6 running on port ${port}`);
  console.log(`Tenlife credentials configured: ${tenlife.hasCredentials()}`);
});
