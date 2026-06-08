# 新刃智能販賣機商城 LINE Bot V6.7

修正 OrderLockCommodity.aspx 建立預訂時 `price` 不能傳空字串的問題。天來 API 會把 `price` 當 Int32 解析，因此現在會送數字價格。

# V6.6 OrderCreate id 參數確認版

本版已確認 `OrderCreate.aspx` 使用 `id` 參數，不使用 `orderNo`。

```js
async function createOrder(id) {
  return requestPost('/OrderCreate.aspx', { id });
}
```

# 新刃智能販賣機商城 LINE Bot V6.4

V6.4 修正 OrderLockCommodity.aspx 預定鎖定 POST body：依天來 POST 範例 B，Query String 帶 code/company/shelflife/sign，body 只送 raw JSON，不再送 commodity=... form 欄位，避免 SerializationException 遇到意外字符 c。

# 新刃智能販賣機商城 V6.2 - 預定鎖定修正版

這一版包含：

- LINE 官方帳號入口
- LIFF/網頁式訂購流程
- 照設備訂購
- 照商品訂購
- Tenlife API 簽章與代理串接
- 查機台、查商品、查可預訂庫存
- 即時預訂鎖定商品
- V6.2：OrderLockCommodity 加入 timeout、ECONNRESET 自動重試、POST body 格式 fallback
- V6.2：建立預訂失敗時前台顯示錯誤與重試按鈕，不再無限載入
- 模擬付款後確認鎖定商品，啟用 QRC
- QRC 領取碼顯示
- 預訂/交易查詢 API 代理端點

## 重要安全提醒

請不要把 `.env` 上傳到 GitHub。以下機密資料請只放在 Render 的 Environment Variables：

```env
TENLIFE_COMPANY=你的營運商ID
TENLIFE_TOKEN=你的TokenKey
LINE_CHANNEL_ACCESS_TOKEN=你的LINE Token
LINE_CHANNEL_SECRET=你的LINE Secret
```

## Render Environment Variables

```env
APP_BASE_URL=https://xinren-vending-line-bot.onrender.com
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
LINE_CHANNEL_SECRET=你的_LINE_Channel_Secret
TENLIFE_API_BASE=https://api.tenlifeservice.com
TENLIFE_COMPANY=你的營運商ID
TENLIFE_TOKEN=你的TokenKey
PAYMENT_MODE=mock
# 可選：只做本機模擬，不呼叫天來 OrderLock / OrderCreate，用於畫面測試
# MOCK_LOCK_ONLY=true
```

## LINE Webhook URL

```text
https://你的Render網址/webhook
```

## 主要頁面

```text
/                         首頁
/order-by-machine.html    照設備訂購
/order-by-product.html    照商品訂購
/confirm.html             確認訂單
/payment.html             等待付款
/qrcode.html              QRC 領取碼
/orders.html              訂單查詢
/guide.html               操作說明
```

## 後端 API

```text
GET  /api/machines
GET  /api/machines/:code/state
GET  /api/commodities
GET  /api/machines/:code/inventory
GET  /api/products/availability
POST /api/orders/lock
POST /api/orders/:id/mock-pay
POST /api/orders/:id/cancel
GET  /api/orders/:id
GET  /api/orders
GET  /api/tenlife/active-orders
GET  /api/tenlife/order-list
GET  /api/tenlife/sales
```

## 上傳 GitHub

1. 解壓縮 ZIP。
2. 把資料夾內的檔案全部上傳到 GitHub 專案最外層。
3. 不要上傳 `.env`。
4. Commit changes。
5. 回 Render 執行 Manual Deploy → Deploy latest commit。

## 付款

目前付款使用模擬付款。正式版要接 LINE Pay、綠界、藍新或銀行金流時，請在 `/payment.html` 與 `/api/orders/:id/mock-pay` 改成正式付款流程。付款成功後再呼叫 Tenlife `OrderCreate.aspx` 啟用 QRC。


## V6.2 預定鎖定修正說明

這版專門修「建立預訂鎖定中」卡住的問題：

- 後端呼叫 `OrderLockCommodity.aspx` 時會自動重試。
- 針對 `ECONNRESET` / `fetch failed` / timeout 會回傳清楚錯誤，不會讓前台一直等待。
- POST body 會依文件範例優先使用 raw JSON + `application/x-www-form-urlencoded`，失敗時再嘗試其他格式。
- 前台 `confirm.html` 會顯示「重新建立預訂」按鈕。

若只是想先測畫面和 QRC 流程，可以在 Render Environment 加：

```env
MOCK_LOCK_ONLY=true
```

這會跳過天來 `OrderLockCommodity.aspx` 與 `OrderCreate.aspx`，只做本機模擬。正式測試領取碼時請刪除或改成 `false`。

## V6.3 更新

本版處理三個重點：

1. 商品圖：商品卡、確認訂單、QRC、我的訂單都會顯示商品圖片。圖片來源為天來 `Commodity.aspx` 的 `photo` / `bigPhoto`。若 API 回的是檔名，請在 Render Environment 設定 `TENLIFE_IMAGE_BASE`。
2. 訂單通知：建立預訂與付款完成後，會推送訂單摘要到 `ADMIN_LINE_USER_ID` 設定的 LINE 使用者。
3. 返回上一步：確認訂單頁新增「回上一步修改商品」，付款頁新增「回確認訂單」，LIFF/LINE 內建瀏覽器不再只能關掉重來。

### 需要新增的 Render Environment

```env
TENLIFE_IMAGE_BASE=請向設備商確認商品圖片網址前綴
ADMIN_LINE_USER_ID=你的LINE使用者ID
```

`ADMIN_LINE_USER_ID` 不是 LINE 官方帳號的 Channel ID，也不是你的 LINE 帳號名稱；需要是可被 LINE Messaging API push 的 userId。若沒有填，系統仍可正常下單，只是不會通知管理者。

## V6.5 Tenlife API Debug

新增除錯頁面：

- `/debug/tenlife-requests`：顯示最近 30 筆呼叫天來 API 的 URL、Header、Body、Response。
- `/debug/last-lock-request`：只顯示最近的 `OrderLockCommodity.aspx` 與 `OrderCreate.aspx` 封包。
- `/debug/clear-tenlife-requests`：清除除錯紀錄。

Token 不會顯示。URL 裡的 sign 可供設備商比對，但不要公開張貼。
