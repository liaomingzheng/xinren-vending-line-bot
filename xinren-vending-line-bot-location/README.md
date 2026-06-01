# 新刃智能販賣機商城 LINE Bot

這是一套可以直接部署的 LINE 官方帳號 Webhook 程式。

## 功能

- 商品商城
- 機台據點
- 缺貨回報
- 故障報修
- 合作放機
- 聯絡客服

## 需要準備

1. LINE 官方帳號
2. LINE Developers Channel
3. Channel access token
4. Channel secret
5. Render、Railway 或 VPS

## 本機安裝

```bash
npm install
cp .env.example .env
npm run dev
```

瀏覽器開啟：

```text
http://localhost:3000
```

看到以下文字代表正常：

```text
新刃智能販賣機商城 LINE Bot is running.
```

## Render 部署

### Build Command

```bash
npm install
```

### Start Command

```bash
npm start
```

### Environment Variables

請在 Render 後台加入：

```text
LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET
SHOP_URL
LOCATION_URL
STOCK_FORM_URL
REPAIR_FORM_URL
PARTNER_FORM_URL
SERVICE_PHONE
```

## LINE Developers 設定

部署完成後，假設你的網址是：

```text
https://xinren-vending-line-bot.onrender.com
```

Webhook URL 請填：

```text
https://xinren-vending-line-bot.onrender.com/webhook
```

然後開啟：

```text
Use webhook: Enabled
```

## 使用者可輸入

| 使用者輸入 | 功能 |
|---|---|
| 商城 | 商品商城 |
| 商品 | 商品商城 |
| 據點 | 機台據點 |
| 位置 | 機台據點 |
| 缺貨 | 缺貨回報 |
| 補貨 | 缺貨回報 |
| 報修 | 故障報修 |
| 卡貨 | 故障報修 |
| 未出貨 | 故障報修 |
| 付款異常 | 故障報修 |
| 合作 | 合作放機 |
| 放機 | 合作放機 |
| 客服 | 聯絡客服 |

## 修改連結

修改 `.env`：

```env
SHOP_URL=https://你的商品商城連結
LOCATION_URL=https://你的機台據點地圖
STOCK_FORM_URL=https://你的缺貨回報表單
REPAIR_FORM_URL=https://你的故障報修表單
PARTNER_FORM_URL=https://你的合作放機表單
```

## 注意

不要把 `.env` 上傳到公開 GitHub，裡面有 LINE Token。
