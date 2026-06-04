"use strict";

/**
 * services/tenlifeApi.js
 * 天來 TENLife API client
 *
 * 重點：
 * 1. sign 計算前，不包含 sign 本身。
 * 2. 參數名稱依 ASCII 由小到大排序，大小寫敏感。
 * 3. 排序後串成 key=value&key=value。
 * 4. 字串最後直接接 TokenKey，不是 &token=xxx。
 * 5. 做 SHA256，輸出 64 碼小寫 hex。
 * 6. GET / POST query 參數都使用同一套簽章規則。
 * 7. POST 的 JSON body，例如 commodity，不放進 query sign；依文件 POST 範例 B，body 與 query 分開。
 */

const crypto = require("crypto");

const DEFAULT_API_BASE = "https://api.tenlifeservice.com";

function getConfig() {
  const apiBase = (process.env.TENLIFE_API_BASE || DEFAULT_API_BASE).replace(/\/$/, "");
  const company = process.env.TENLIFE_COMPANY;
  const token = process.env.TENLIFE_TOKEN;

  if (!company) {
    throw new Error("Missing environment variable: TENLIFE_COMPANY");
  }
  if (!token) {
    throw new Error("Missing environment variable: TENLIFE_TOKEN");
  }

  return { apiBase, company, token };
}

function shouldIncludeValue(value) {
  return value !== undefined && value !== null;
}

function normalizeValue(value) {
  if (value instanceof Date) return formatDateTime(value);
  return String(value);
}

/**
 * 依文件規則產生簽章用原始字串。
 * 注意：這裡刻意不做 encodeURIComponent，避免空白被轉成 + 或 %20 後造成 sign 不一致。
 * 若之後設備商要求「簽章前也要 UrlEncode 非 ASCII value」，只要把此處 value 改成 encodeURIComponent(value) 即可。
 */
function buildSignBaseString(params) {
  return Object.keys(params)
    .filter((key) => key !== "sign" && key !== "SIGN" && shouldIncludeValue(params[key]))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((key) => `${key}=${normalizeValue(params[key])}`)
    .join("&");
}

function buildSign(params, token) {
  const base = buildSignBaseString(params);
  return crypto
    .createHash("sha256")
    .update(base + token, "utf8")
    .digest("hex");
}

function appendSign(params, token) {
  const clean = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (shouldIncludeValue(value)) clean[key] = normalizeValue(value);
  }
  clean.sign = buildSign(clean, token);
  return clean;
}

function toQueryString(params) {
  const searchParams = new URLSearchParams();
  for (const key of Object.keys(params)) {
    if (shouldIncludeValue(params[key])) searchParams.append(key, normalizeValue(params[key]));
  }
  return searchParams.toString();
}

async function requestTenlife(pathname, options = {}) {
  const { apiBase, company, token } = getConfig();
  const method = (options.method || "GET").toUpperCase();
  const query = {
    ...(options.query || {}),
    company
  };

  const signedQuery = appendSign(query, token);
  const url = `${apiBase}/${String(pathname).replace(/^\//, "")}?${toQueryString(signedQuery)}`;

  const fetchOptions = {
    method,
    headers: {
      "Accept": "application/json",
      ...(options.headers || {})
    }
  };

  if (method === "POST") {
    if (options.body !== undefined && options.body !== null) {
      fetchOptions.headers["Content-Type"] = "application/json; charset=utf-8";
      fetchOptions.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
    } else {
      fetchOptions.headers["Content-Type"] = "application/x-www-form-urlencoded";
      fetchOptions.body = "";
    }
  }

  const response = await fetch(url, fetchOptions);
  const text = await response.text();

  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`TENLife API returned non-JSON response. HTTP ${response.status}. Body: ${text.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(`TENLife API HTTP ${response.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateTime(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// ========== 設備基本資訊 ==========

async function getMachines() {
  return requestTenlife("Machine.aspx", { method: "GET" });
}

async function getMachineState(code) {
  return requestTenlife("MachineState.aspx", {
    method: "GET",
    query: code ? { code } : {}
  });
}

async function getCommodities(filters = {}) {
  const query = {};
  if (filters.commodityCode) query.commodityCode = filters.commodityCode;
  if (filters.commodityID) query.commodityID = filters.commodityID;
  return requestTenlife("Commodity.aspx", { method: "GET", query });
}

async function getMachineInventory(code) {
  if (!code) throw new Error("getMachineInventory requires machine code");
  return requestTenlife("MachineCommodity.aspx", {
    method: "GET",
    query: { code }
  });
}

async function getOrderableInventory(code) {
  if (!code) throw new Error("getOrderableInventory requires machine code");
  return requestTenlife("OrderMachineCommodity.aspx", {
    method: "GET",
    query: { code }
  });
}

// ========== 交易相關 ==========

async function getSales({ begin, end, code, commodityCode, saleID } = {}) {
  if (!begin) throw new Error("getSales requires begin: YYYY-MM-DD hh:mm");
  if (!end) throw new Error("getSales requires end: YYYY-MM-DD hh:mm");

  const query = { begin, end };
  if (code) query.code = code;
  if (commodityCode) query.commodityCode = commodityCode;
  if (saleID) query.saleID = saleID;

  return requestTenlife("Sales.aspx", { method: "GET", query });
}

// ========== 預定相關 ==========

/**
 * 即時預訂鎖定商品
 * @param {string} code 智販機編號
 * @param {Array<{commodityCode:string, quantity:number, price?:string|number}>} commodity
 * @param {string|Date} shelflife 預訂保留有效時間，格式 YYYY-MM-DD hh:mm:ss
 */
async function lockOrder({ code, commodity, shelflife }) {
  if (!code) throw new Error("lockOrder requires machine code");
  if (!Array.isArray(commodity) || commodity.length === 0) {
    throw new Error("lockOrder requires commodity array");
  }

  const safeCommodity = commodity.map((item) => ({
    commodityCode: String(item.commodityCode),
    quantity: Number(item.quantity || 1),
    price: item.price === undefined || item.price === null ? "" : String(item.price)
  }));

  return requestTenlife("OrderLockCommodity.aspx", {
    method: "POST",
    query: {
      code,
      shelflife: shelflife ? normalizeValue(shelflife) : formatDateTime(addMinutes(new Date(), 15))
    },
    body: {
      commodity: safeCommodity
    }
  });
}

async function createOrder(id) {
  if (!id) throw new Error("createOrder requires QRC id");
  return requestTenlife("OrderCreate.aspx", {
    method: "POST",
    query: { id }
  });
}

async function unlockOrder(id) {
  if (!id) throw new Error("unlockOrder requires QRC id");
  return requestTenlife("OrderUnlockCommodity.aspx", {
    method: "POST",
    query: { id }
  });
}

async function cancelOrder(id) {
  if (!id) throw new Error("cancelOrder requires QRC id");
  return requestTenlife("OrderCancel.aspx", {
    method: "POST",
    query: { id }
  });
}

async function getActiveOrders(code) {
  if (!code) throw new Error("getActiveOrders requires machine code");
  return requestTenlife("ActiveOrderCreate.aspx", {
    method: "GET",
    query: { code }
  });
}

async function getOrderList({ begin, end, future = 1, code } = {}) {
  if (!begin) throw new Error("getOrderList requires begin: YYYY-MM-DD");
  if (!end) throw new Error("getOrderList requires end: YYYY-MM-DD");

  const query = { begin, end, future };
  if (code) query.code = code;

  return requestTenlife("OrderList.aspx", { method: "GET", query });
}

// ========== 工具：可用於本機檢查 sign 是否符合文件範例 ==========

function selfTestSignature() {
  const sampleSign = buildSign(
    { MerchantID: "0001", OrderID: "0123456" },
    "TEST"
  );

  return {
    signBase: buildSignBaseString({ MerchantID: "0001", OrderID: "0123456" }),
    sign: sampleSign,
    expected: "77b21395d6989067806d08c2b070853ad96508e7adcb79549746b90bc9690c48",
    pass: sampleSign === "77b21395d6989067806d08c2b070853ad96508e7adcb79549746b90bc9690c48"
  };
}
//function hasCredentials() {
 // return Boolean(
  //  process.env.TENLIFE_API_BASE &&
  //  process.env.TENLIFE_COMPANY &&
   // process.env.TENLIFE_TOKEN
//  );
//}
module.exports = {
 // hasCredentials,
  buildSignBaseString,
  buildSign,
  appendSign,
  toQueryString,
  requestTenlife,
  formatDate,
  formatDateTime,
  getMachines,
  getMachineState,
  getCommodities,
  getMachineInventory,
  getOrderableInventory,
  getSales,
  lockOrder,
  createOrder,
  unlockOrder,
  cancelOrder,
  getActiveOrders,
  getOrderList,
  selfTestSignature
};
