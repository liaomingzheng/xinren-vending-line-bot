const crypto = require('crypto');

const API_BASE = process.env.TENLIFE_API_BASE || 'https://api.tenlifeservice.com';
const COMPANY = process.env.TENLIFE_COMPANY || '';
const TOKEN = process.env.TENLIFE_TOKEN || '';

const DEMO_PRODUCTS = [
  { commodityID: 2030713, commodityCode: 'CNNPDC122802', commodityName: '櫻花 Hello Kitty 娃包 1', commodityTypeName: 'IP 娃', brandName: 'Otto', price: 499, photo: '', stop: 0 },
  { commodityID: 2027280, commodityCode: '999998', commodityName: 'demo1', commodityTypeName: 'test', brandName: 'M', price: 1, photo: '', stop: 0 },
  { commodityID: 3000001, commodityCode: 'DRINK001', commodityName: '可口可樂 600ml', commodityTypeName: '飲料', brandName: 'Coca-Cola', price: 30, photo: '', stop: 0 },
  { commodityID: 3000002, commodityCode: 'TEA001', commodityName: '原萃綠茶 580ml', commodityTypeName: '飲料', brandName: '原萃', price: 25, photo: '', stop: 0 }
];

const LOCAL_MACHINES = [
  {
    code: 'F6380162C464EF',
    name: 'Otto 黑色機臺',
    area: '南投埔里',
    address: '南投縣埔里鎮桃迷里大學路一號',
    mapUrl: 'https://maps.app.goo.gl/2bX5Xt6S8NXAEk9D7',
    lat: 23.9506,
    lng: 120.9289,
    note: '1樓大廳／門口右側'
  },
  {
    code: 'F638C49405968C',
    name: 'Otto 藍色機臺',
    area: '南投埔里',
    address: '南投縣埔里鎮桃迷里大學路一號',
    mapUrl: 'https://maps.app.goo.gl/2bX5Xt6S8NXAEk9D7',
    lat: 23.9507,
    lng: 120.9291,
    note: '1樓大廳／門口右側'
  },
  {
    code: 'F638C3B40B65CC',
    name: 'Otto 男宿',
    area: '高雄大樹',
    address: '高雄市大樹區三和里學城路一段1號',
    mapUrl: 'https://maps.app.goo.gl/9x3eaFvodGGbGYf3A',
    lat: 22.7288,
    lng: 120.4058,
    note: '男宿'
  },
  {
    code: 'F638C41405C535',
    name: 'Otto 綜合教學大樓',
    area: '高雄大樹',
    address: '高雄市大樹區三和里學城路一段1號',
    mapUrl: 'https://maps.app.goo.gl/9x3eaFvodGGbGYf3A',
    lat: 22.7291,
    lng: 120.4061,
    note: '綜合教學大樓'
  }
];

function hasCredentials() {
  return Boolean(COMPANY && TOKEN && API_BASE);
}

function signParams(params) {
  const clean = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '') clean[key] = String(value);
  }
  const sortedKeys = Object.keys(clean).sort();
  const signString = sortedKeys.map((key) => `${key}=${clean[key]}`).join('&') + TOKEN;
  return crypto.createHash('sha256').update(signString, 'utf8').digest('hex');
}

function buildUrl(path, params = {}) {
  const queryParams = { ...params, company: COMPANY };
  queryParams.sign = signParams(queryParams);
  const url = new URL(path, API_BASE);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function requestGet(path, params = {}) {
  if (!hasCredentials()) throw new Error('尚未設定 TENLIFE_COMPANY / TENLIFE_TOKEN');
  const url = buildUrl(path, params);
  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  try { return JSON.parse(text); } catch (err) { throw new Error(`Tenlife 回傳不是 JSON：${text.slice(0, 300)}`); }
}

async function requestPost(path, query = {}, body = undefined) {
  if (!hasCredentials()) throw new Error('尚未設定 TENLIFE_COMPANY / TENLIFE_TOKEN');
  const url = buildUrl(path, query);
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8' }
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  try { return JSON.parse(text); } catch (err) { throw new Error(`Tenlife 回傳不是 JSON：${text.slice(0, 300)}`); }
}

function mergeMachineInfo(apiMachine = {}) {
  const local = LOCAL_MACHINES.find((m) => m.code === apiMachine.code) || {};
  return {
    ...apiMachine,
    ...local,
    name: local.name || apiMachine.name || apiMachine.code,
    code: apiMachine.code || local.code
  };
}

async function listMachines() {
  if (!hasCredentials()) return LOCAL_MACHINES;
  const data = await requestGet('/Machine.aspx');
  if (data.state !== 0) throw new Error(data.message || '查詢智販機列表失敗');
  const apiMachines = Array.isArray(data.machine) ? data.machine : [];
  const merged = LOCAL_MACHINES.map((local) => mergeMachineInfo(apiMachines.find((m) => m.code === local.code) || { code: local.code }));
  return merged;
}

async function machineState(code) {
  if (!hasCredentials()) return { machine: [{ code, uploadTime: '', state: 'DEMO', temperature1: 0 }], state: 0, message: '' };
  return requestGet('/MachineState.aspx', { code });
}

async function commodities(filters = {}) {
  if (!hasCredentials()) return { commodity: DEMO_PRODUCTS, state: 0, message: '' };
  return requestGet('/Commodity.aspx', filters);
}

async function machineCommodity(code) {
  if (!hasCredentials()) {
    return {
      state: 0,
      message: '',
      commodity: [
        { commodityCode: 'DRINK001', commodityID: 3000001, layer: 'A1', shelflife: '2026-12-31 23:59:59' },
        { commodityCode: 'DRINK001', commodityID: 3000001, layer: 'A2', shelflife: '2026-12-31 23:59:59' },
        { commodityCode: 'TEA001', commodityID: 3000002, layer: 'A3', shelflife: '2026-12-31 23:59:59' },
        { commodityCode: 'CNNPDC122802', commodityID: 2030713, layer: 'B1', shelflife: '2026-12-31 23:59:59' }
      ]
    };
  }
  return requestGet('/MachineCommodity.aspx', { code });
}

async function orderMachineCommodity(code) {
  if (!hasCredentials()) {
    return { state: 0, message: '', commodity: [
      { commodityCode: 'DRINK001', commodityID: 3000001, quantity: 8 },
      { commodityCode: 'TEA001', commodityID: 3000002, quantity: 6 },
      { commodityCode: 'CNNPDC122802', commodityID: 2030713, quantity: 2 },
      { commodityCode: '999998', commodityID: 2027280, quantity: 1 }
    ]};
  }
  return requestGet('/OrderMachineCommodity.aspx', { code });
}

async function sales({ begin, end, code, commodityCode, saleID } = {}) {
  if (!hasCredentials()) return { state: 0, message: '', sales: [] };
  return requestGet('/Sales.aspx', { begin, end, code, commodityCode, saleID });
}

async function lockOrder({ code, shelflife, commodity }) {
  if (!hasCredentials()) return { state: 0, message: '', id: `DEMO-${Date.now()}` };
  return requestPost('/OrderLockCommodity.aspx', { code, shelflife }, { commodity });
}

async function createOrder(id) {
  if (!hasCredentials()) return { state: 0, message: '' };
  return requestPost('/OrderCreate.aspx', { id });
}

async function unlockOrder(id) {
  if (!hasCredentials()) return { state: 0, message: '' };
  return requestPost('/OrderUnlockCommodity.aspx', { id });
}

async function cancelOrder(id) {
  if (!hasCredentials()) return { state: 0, message: '' };
  return requestPost('/OrderCancel.aspx', { id });
}

async function activeOrders(code) {
  if (!hasCredentials()) return { state: 0, message: '', barcode: [] };
  return requestGet('/ActiveOrderCreate.aspx', { code });
}

async function orderList({ begin, end, code, future = 1 } = {}) {
  if (!hasCredentials()) return { state: 0, message: '', order: [] };
  return requestGet('/OrderList.aspx', { begin, end, code, future });
}

module.exports = {
  LOCAL_MACHINES,
  DEMO_PRODUCTS,
  hasCredentials,
  signParams,
  listMachines,
  machineState,
  commodities,
  machineCommodity,
  orderMachineCommodity,
  sales,
  lockOrder,
  createOrder,
  unlockOrder,
  cancelOrder,
  activeOrders,
  orderList
};
