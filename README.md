# 新刃智能販賣機商城 LINE Bot - V4 iRent 地圖版

這版把「據點」改成像 iRent 租車據點一樣的地圖選機台模式。

## 功能

- LINE 輸入「據點」會出現「開啟機台地圖」按鈕
- `/locations` 打開就是地圖
- 地圖上直接顯示販賣機標記
- 可選南投埔里／高雄大樹
- 可搜尋機台名稱、編號、地址
- 可使用附近機台排序
- 點下方機台卡片或地圖標記，可以選擇要前往的機台
- 按「前往這台」開啟 Google 地圖導航

## Render 環境變數

建議設定：

```env
LINE_CHANNEL_ACCESS_TOKEN=你的 token
LINE_CHANNEL_SECRET=你的 secret
PUBLIC_BASE_URL=https://xinren-vending-line-bot.onrender.com
SHOP_URL=你的商品商城網址
STOCK_FORM_URL=你的缺貨回報表單
REPAIR_FORM_URL=你的故障報修表單
PARTNER_FORM_URL=你的合作放機表單
```

## 上傳方式

1. 解壓縮 ZIP
2. 到 GitHub 專案
3. 上傳解壓後資料夾裡面的檔案，不要上傳整個資料夾
4. Commit changes
5. 到 Render 按 Manual Deploy → Deploy latest commit
6. 測試：`https://xinren-vending-line-bot.onrender.com/locations`
