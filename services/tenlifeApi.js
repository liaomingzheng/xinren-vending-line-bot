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


const MAX_DEBUG_REQUESTS = 30;
const debugRequests = [];

function redactUrlForDebug(url) {
  try {
    const parsed = new URL(url);
    // sign 可以給設備商比對；Token 不會出現在 URL。
    return parsed.toString();
  } catch (_) {
    return String(url || '');
  }
}

function safePreview(value, limit = 3000) {
  if (value === undefined || value === null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text.length > limit ? `${text.slice(0, limit)}...（已截斷）` : text;
}

function recordDebugRequest(entry) {
  const row = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    time: new Date().toISOString(),
    ...entry,
    url: redactUrlForDebug(entry.url),
    body: safePreview(entry.body),
    responseText: safePreview(entry.responseText),
    error: entry.error ? safePreview(entry.error) : undefined
  };
  debugRequests.unshift(row);
  if (debugRequests.length > MAX_DEBUG_REQUESTS) debugRequests.length = MAX_DEBUG_REQUESTS;
  return row;
}

function getDebugRequests() {
  return debugRequests;
}

function clearDebugRequests() {
  debugRequests.length = 0;
}

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkReset(error) {
  const text = `${error?.message || ''} ${error?.cause?.code || ''} ${error?.cause?.message || ''}`;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network/i.test(text);
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'xinren-vending-line-bot/6.4',
        ...(options.headers || {})
      }
    });
    const text = await res.text();
    return { res, text };
  } finally {
    clearTimeout(timer);
  }
}

function parseTenlifeJson(text) {
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Tenlife 回傳不是 JSON：${String(text || '').slice(0, 300)}`);
  }
}

async function requestGet(path, params = {}, options = {}) {
  if (!hasCredentials()) throw new Error('尚未設定 TENLIFE_COMPANY / TENLIFE_TOKEN');
  const url = buildUrl(path, params);
  const timeoutMs = options.timeoutMs || 15000;
  const attempts = options.attempts || 2;
  let lastError;

  for (let i = 1; i <= attempts; i += 1) {
    try {
      const { text } = await fetchTextWithTimeout(url, { method: 'GET' }, timeoutMs);
      const data = parseTenlifeJson(text);
      recordDebugRequest({ method: 'GET', path, url, query: params, status: 'success', responseState: data.state, responseMessage: data.message, responseText: text });
      return data;
    } catch (error) {
      lastError = error;
      if (i < attempts && isNetworkReset(error)) await sleep(400 * i);
      else break;
    }
  }
  recordDebugRequest({ method: 'GET', path, url, query: params, status: 'error', error: lastError?.message || String(lastError) });
  throw lastError;
}

function postBodies(body, options = {}) {
  if (body === undefined) return [{ label: 'empty', headers: {}, body: undefined }];

  // 天來文件第 21 頁 POST 範例 B：Query String 帶參數與 sign，HTTP body 直接放 JSON。
  // 之前曾用 commodity=... 的 form body，天來 WCF 會把第一個字元 c 當作 JSON 解析，造成 SerializationException。
  // 因此 V6.4 起嚴格禁止把 commodity 包成 form 欄位，只送原始 JSON 字串。
  const json = JSON.stringify(body);
  const contentType = options.contentType || 'application/x-www-form-urlencoded; charset=utf-8';

  return [
    {
      label: 'raw-json-body',
      headers: {
        'Content-Type': contentType,
        'Content-Length': Buffer.byteLength(json, 'utf8').toString()
      },
      body: json
    },
    // 少數環境會依 Content-Type 選擇 JSON parser；第一種不通時才用 application/json 再試一次。
    {
      label: 'raw-json-body-json-content-type',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(json, 'utf8').toString()
      },
      body: json
    }
  ];
}

async function requestPost(path, query = {}, body = undefined, options = {}) {
  if (!hasCredentials()) throw new Error('尚未設定 TENLIFE_COMPANY / TENLIFE_TOKEN');
  const url = buildUrl(path, query);
  const timeoutMs = options.timeoutMs || 18000;
  const attempts = options.attempts || 2;
  const modes = postBodies(body, options);
  let lastError;
  let lastText = '';

  for (const mode of modes) {
    for (let i = 1; i <= attempts; i += 1) {
      try {
        const { text } = await fetchTextWithTimeout(url, {
          method: 'POST',
          headers: mode.headers,
          body: mode.body
        }, timeoutMs);
        lastText = text;
        const data = parseTenlifeJson(text);

        // 天來回 state=0 才算成功。非 0 時直接回傳給 server.js 顯示原因，不再改成錯誤格式亂重送。
        data.__postMode = mode.label;
        recordDebugRequest({
          method: 'POST',
          path,
          url,
          query,
          mode: mode.label,
          headers: mode.headers,
          body: mode.body,
          status: 'success',
          responseState: data.state,
          responseMessage: data.message,
          responseText: text
        });
        return data;
      } catch (error) {
        lastError = error;
        const msg = String(error?.message || '');

        // 如果是「不是 JSON」或天來 .NET SerializationException，表示目前 Content-Type/body parser 不接受，換下一個 raw JSON mode。
        const shouldTryNextMode = /不是 JSON|SerializationException|XmlException|反序列化|unexpected|意外字符/i.test(msg + ' ' + lastText);
        if (shouldTryNextMode) break;

        if (i < attempts && isNetworkReset(error)) await sleep(600 * i);
        else break;
      }
    }

    // 換下一種 Content-Type，但 body 仍維持 raw JSON，絕不送 commodity=...
    await sleep(200);
  }

  recordDebugRequest({
    method: 'POST',
    path,
    url,
    query,
    mode: modes.map((m) => m.label).join(' / '),
    body: modes[0]?.body,
    status: 'error',
    responseText: lastText,
    error: lastError?.message || String(lastError)
  });
  if (isNetworkReset(lastError)) {
    throw new Error('天來 API 連線中斷（ECONNRESET），系統已重試仍失敗，請稍後再試。');
  }
  if (lastText) {
    throw new Error(`天來 POST 回傳無法解析：${String(lastText).slice(0, 500)}`);
  }
  throw lastError;
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

function validTaiwanLatLng(lat, lng) {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && la >= 21 && la <= 26 && ln >= 119 && ln <= 123;
}

async function listMachines() {
  if (!hasCredentials()) return LOCAL_MACHINES;
  const data = await requestGet('/Machine.aspx');
  if (data.state !== 0) throw new Error(data.message || '查詢智販機列表失敗');
  const apiMachines = Array.isArray(data.machine) ? data.machine : [];
  const seen = new Set();
  const merged = [];

  for (const apiMachine of apiMachines) {
    const local = LOCAL_MACHINES.find((m) => m.code === apiMachine.code) || {};
    const row = mergeMachineInfo(apiMachine);
    const apiLat = apiMachine.latitude || apiMachine.lat;
    const apiLng = apiMachine.longitude || apiMachine.lng;
    if (!local.lat && validTaiwanLatLng(apiLat, apiLng)) {
      row.lat = Number(apiLat);
      row.lng = Number(apiLng);
    }
    if (!local.mapUrl && row.lat && row.lng) row.mapUrl = `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`;
    merged.push(row);
    seen.add(row.code);
  }

  for (const local of LOCAL_MACHINES) {
    if (!seen.has(local.code)) merged.push(local);
  }
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
  if (!code) throw new Error('缺少智販機編號 code');
  if (!shelflife) throw new Error('缺少預訂保留時間 shelflife');
  if (!Array.isArray(commodity) || commodity.length === 0) throw new Error('缺少預訂商品 commodity');
  return requestPost('/OrderLockCommodity.aspx', { code, shelflife }, { commodity }, { attempts: 3, timeoutMs: 20000, contentType: 'application/x-www-form-urlencoded; charset=utf-8' });
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
  buildUrl,
  requestGet,
  requestPost,
  getDebugRequests,
  clearDebugRequests,
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
