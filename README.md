# 新刃智能販賣機商城 LINE Bot V3 地圖據點版

這是一套可以部署到 Render 的 LINE 官方帳號 Webhook 程式。

## V3 新功能

- `/locations` 據點地圖網頁
- Otto 機台地圖標記
- 南投埔里／高雄大樹篩選
- 搜尋機台編號、名稱、地址
- 附近機台排序
- 一鍵 Google 地圖導航
- 一鍵報修／缺貨回報

## Render 環境變數

請在 Render 的 Environment 設定：

```env
LINE_CHANNEL_ACCESS_TOKEN=你的_LINE_Channel_Access_Token
LINE_CHANNEL_SECRET=你的_LINE_Channel_Secret
BASE_URL=https://xinren-vending-line-bot.onrender.com
SHOP_URL=https://你的商品商城網址
LOCATION_URL=https://xinren-vending-line-bot.onrender.com/locations
STOCK_FORM_URL=https://你的缺貨回報表單
REPAIR_FORM_URL=https://你的故障報修表單
PARTNER_FORM_URL=https://你的合作放機表單
```

## LINE Webhook URL

```text
https://xinren-vending-line-bot.onrender.com/webhook
```

## 據點地圖 URL

```text
https://xinren-vending-line-bot.onrender.com/locations
```

## 使用者指令

- 商城
- 據點
- 南投
- 高雄
- 缺貨
- 報修
- 合作
- 客服
