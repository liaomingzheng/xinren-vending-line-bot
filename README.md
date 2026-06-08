# 新刃智能販賣機商城 LINE Bot / LIFF V7 正式 UI 版

此版本基於 V6.7，保留 Tenlife API 串接與 debug 功能，主要改版 LIFF 前台畫面，讓流程更接近 iRent / 手機 App 型式。

## V7 更新重點

- 全站改成正式手機 App 風格 UI
- 照設備訂購加入更完整的地圖、列表、設備詳情卡片
- 商品清單改成商品卡：圖片、名稱、價格、庫存、加號加入購物車
- 確認訂單頁改成正式結帳畫面
- 等待付款頁改成付款倒數卡片
- QRC 領取碼頁改成票券式完成頁
- 我的訂單頁加入底部導覽與分頁樣式
- 所有主要頁面保留返回上一頁功能

## 上傳方式

1. 解壓縮此 ZIP。
2. 將所有檔案上傳到 GitHub 專案最外層，覆蓋原本檔案。
3. Commit changes。
4. Render → Manual Deploy → Deploy latest commit。
5. 測試：

```
https://xinren-vending-line-bot.onrender.com/order-by-machine.html?v=7
https://xinren-vending-line-bot.onrender.com/order-by-product.html?v=7
```

## 圖片顯示

商品圖片仍然依照 Tenlife Commodity.aspx 的 photo / bigPhoto 欄位，若 API 回傳的是檔名，需要在 Render Environment 新增：

```
TENLIFE_IMAGE_BASE=設備商提供的圖片網址前綴
```
