# 新刃智能販賣機商城 V6 - LINE + LIFF + 天來 API 串接版

這一版包含：

- LINE 官方帳號入口
- LIFF/網頁式訂購流程
- 照設備訂購
- 照商品訂購
- Tenlife API 簽章與代理串接
- 查機台、查商品、查可預訂庫存
- 即時預訂鎖定商品
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
