require("dotenv").config();

const path = require("path");
const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const PORT = process.env.PORT || 3000;
const BASE_URL = (process.env.BASE_URL || process.env.RENDER_EXTERNAL_URL || "https://xinren-vending-line-bot.onrender.com").replace(/\/$/, "");

const SHOP_URL = process.env.SHOP_URL || "https://line.me";
const LOCATION_URL = process.env.LOCATION_URL || `${BASE_URL}/locations`;
const STOCK_FORM_URL = process.env.STOCK_FORM_URL || "https://forms.gle";
const REPAIR_FORM_URL = process.env.REPAIR_FORM_URL || "https://forms.gle";
const PARTNER_FORM_URL = process.env.PARTNER_FORM_URL || "https://forms.gle";

app.use("/public", express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("新刃智能販賣機商城 LINE Bot V3 地圖據點版 is running.");
});

app.get("/locations", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "locations.html"));
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.status(200).end();
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type === "follow") {
    return replyMessage(event.replyToken, welcomeMessage());
  }

  if (event.type !== "message" || event.message.type !== "text") {
    return replyMessage(event.replyToken, textMessage("目前請使用文字訊息操作喔。"));
  }

  const userText = event.message.text.trim();

  if (matchKeyword(userText, ["商城", "商品", "購買", "買東西", "甜點", "飲料"])) {
    return replyMessage(event.replyToken, shopMessage());
  }

  if (matchKeyword(userText, ["據點", "位置", "地點", "機台", "在哪", "地址", "地圖", "附近"])) {
    return replyMessage(event.replyToken, locationMessage());
  }

  if (matchKeyword(userText, ["南投", "埔里"])) {
    return replyMessage(event.replyToken, nantouLocationMessage());
  }

  if (matchKeyword(userText, ["高雄", "大樹", "男宿", "綜合教學"])) {
    return replyMessage(event.replyToken, kaohsiungLocationMessage());
  }

  if (matchKeyword(userText, ["缺貨", "補貨", "沒貨", "商品沒了"])) {
    return replyMessage(event.replyToken, stockMessage());
  }

  if (matchKeyword(userText, ["報修", "故障", "卡貨", "未出貨", "付款異常", "取物門", "升降台", "履帶"])) {
    return replyMessage(event.replyToken, repairMessage());
  }

  if (matchKeyword(userText, ["合作", "放機", "場地", "招商", "寄售"])) {
    return replyMessage(event.replyToken, partnerMessage());
  }

  if (matchKeyword(userText, ["客服", "聯絡", "電話", "人工"])) {
    return replyMessage(event.replyToken, customerServiceMessage());
  }

  return replyMessage(event.replyToken, mainMenuMessage());
}

function matchKeyword(text, keywords) {
  return keywords.some(keyword => text.includes(keyword));
}

function replyMessage(replyToken, messages) {
  return client.replyMessage({
    replyToken,
    messages: Array.isArray(messages) ? messages : [messages]
  });
}

function textMessage(text) {
  return { type: "text", text };
}

function welcomeMessage() {
  return [
    textMessage(
      "歡迎來到「新刃智能販賣機商城」\n\n" +
      "這裡可以查詢商品、機台據點地圖、缺貨回報、故障報修與合作放機。\n\n" +
      "請點選下方功能，或直接輸入：商城、據點、缺貨、報修、合作、客服"
    ),
    mainMenuFlex()
  ];
}

function mainMenuMessage() {
  return [
    textMessage(
      "請選擇您需要的服務：\n\n" +
      "1. 商品商城\n" +
      "2. 機台據點地圖\n" +
      "3. 缺貨回報\n" +
      "4. 故障報修\n" +
      "5. 合作放機\n" +
      "6. 聯絡客服\n\n" +
      "也可以直接輸入關鍵字，例如：據點、報修、缺貨、合作。"
    ),
    mainMenuFlex()
  ];
}

function shopMessage() {
  return [
    textMessage("這裡是「新刃智能販賣機商城」。\n\n您可以查看販賣機商品、熱門商品、限定商品與預購商品。"),
    buttonsTemplate("商品商城", "請選擇商品服務", [
      { type: "uri", label: "進入商品商城", uri: SHOP_URL },
      { type: "message", label: "查詢機台商品", text: "我要查詢機台商品" }
    ])
  ];
}

function locationMessage() {
  return [
    textMessage(
      "新刃智能販賣機據點地圖\n\n" +
      "可查看全部 Otto 機台、使用附近排序、依南投／高雄篩選，並可一鍵導航、報修、缺貨回報。"
    ),
    {
      type: "template",
      altText: "機台據點地圖",
      template: {
        type: "buttons",
        title: "機台據點地圖",
        text: "請選擇查詢方式",
        actions: [
          { type: "uri", label: "開啟據點地圖", uri: LOCATION_URL },
          { type: "message", label: "南投埔里據點", text: "南投據點" },
          { type: "message", label: "高雄大樹據點", text: "高雄據點" }
        ]
      }
    }
  ];
}

function nantouLocationMessage() {
  return [
    textMessage(
      "南投埔里 Otto 機台\n\n" +
      "1. Otto 黑色機臺\n" +
      "機台編號：F6380162C464EF\n" +
      "地址：南投縣埔里鎮桃迷里大學路一號\n" +
      "地圖：https://maps.app.goo.gl/2bX5Xt6S8NXAEk9D7\n\n" +
      "2. Otto 藍色機臺\n" +
      "機台編號：F638C49405968C\n" +
      "地址：南投縣埔里鎮桃迷里大學路一號\n" +
      "地圖：https://maps.app.goo.gl/2bX5Xt6S8NXAEk9D7"
    ),
    buttonsTemplate("南投埔里據點", "開啟南投埔里地圖", [
      { type: "uri", label: "導航到南投據點", uri: "https://maps.app.goo.gl/2bX5Xt6S8NXAEk9D7" },
      { type: "uri", label: "查看據點地圖", uri: `${LOCATION_URL}?area=nantou` }
    ])
  ];
}

function kaohsiungLocationMessage() {
  return [
    textMessage(
      "高雄大樹 Otto 機台\n\n" +
      "1. Otto 男宿\n" +
      "機台編號：F638C3B40B65CC\n" +
      "地址：高雄市大樹區三和里學城路一段1號\n" +
      "地圖：https://maps.app.goo.gl/9x3eaFvodGGbGYf3A\n\n" +
      "2. Otto 綜合教學大樓\n" +
      "機台編號：F638C41405C535\n" +
      "地址：高雄市大樹區三和里學城路一段1號\n" +
      "地圖：https://maps.app.goo.gl/9x3eaFvodGGbGYf3A"
    ),
    buttonsTemplate("高雄大樹據點", "開啟高雄大樹地圖", [
      { type: "uri", label: "導航到高雄據點", uri: "https://maps.app.goo.gl/9x3eaFvodGGbGYf3A" },
      { type: "uri", label: "查看據點地圖", uri: `${LOCATION_URL}?area=kaohsiung` }
    ])
  ];
}

function stockMessage() {
  return [
    textMessage(
      "感謝您的缺貨回報。\n\n" +
      "請提供以下資料：\n" +
      "1. 機台編號\n" +
      "2. 機台位置\n" +
      "3. 缺貨商品\n" +
      "4. 缺貨貨道，例如 A1、B3\n" +
      "5. 現場照片，若方便提供\n\n" +
      "我們收到後會安排補貨。"
    ),
    buttonsTemplate("缺貨回報", "請選擇回報方式", [
      { type: "uri", label: "填寫缺貨回報", uri: STOCK_FORM_URL },
      { type: "message", label: "複製回報格式", text: "我要回報缺貨\n機台編號：\n缺貨商品：\n貨道編號：\n現場照片：" }
    ])
  ];
}

function repairMessage() {
  return [
    textMessage(
      "請選擇或提供故障問題。\n\n" +
      "常見問題：卡貨／付款成功未出貨／取物門異常／升降台異常／螢幕異常／其他。"
    ),
    {
      type: "template",
      altText: "故障報修",
      template: {
        type: "buttons",
        title: "故障報修",
        text: "請選擇報修方式",
        actions: [
          { type: "uri", label: "填寫故障報修", uri: REPAIR_FORM_URL },
          { type: "message", label: "卡貨／未出貨", text: "我要報修：卡貨／未出貨\n機台編號：\n發生時間：\n付款方式：\n商品名稱：\n照片：" },
          { type: "message", label: "付款異常", text: "我要報修：付款異常\n機台編號：\n發生時間：\n付款方式：\n付款紀錄：\n照片：" }
        ]
      }
    }
  ];
}

function partnerMessage() {
  return [
    textMessage(
      "歡迎申請智能販賣機合作放置。\n\n" +
      "請提供：店名／公司名、預計放置地址、場地類型、每日人流量、是否可提供電源、聯絡人與電話。"
    ),
    buttonsTemplate("合作放機申請", "申請放置新刃智能販賣機", [
      { type: "uri", label: "填寫合作申請", uri: PARTNER_FORM_URL },
      { type: "message", label: "我要合作放機", text: "我要申請合作放機" }
    ])
  ];
}

function customerServiceMessage() {
  return textMessage(
    "您好，請直接留下您的問題。\n\n" +
    "若是機台問題，請提供：\n" +
    "1. 機台編號\n" +
    "2. 機台位置\n" +
    "3. 問題描述\n" +
    "4. 現場照片或付款紀錄\n\n" +
    "客服收到後會盡快協助您。"
  );
}

function buttonsTemplate(title, text, actions) {
  return {
    type: "template",
    altText: title,
    template: { type: "buttons", title, text, actions }
  };
}

function mainMenuFlex() {
  return {
    type: "flex",
    altText: "新刃智能販賣機商城主選單",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: "新刃智能販賣機商城", weight: "bold", size: "xl", color: "#111111" },
          { type: "text", text: "Otto 智能販賣機服務中心", size: "sm", color: "#666666", margin: "sm" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          menuButton("商品商城", "查看販賣機商品", "商城"),
          menuButton("機台據點地圖", "查看附近 Otto 機台", "據點"),
          menuButton("缺貨回報", "回報商品缺貨", "缺貨"),
          menuButton("故障報修", "卡貨、付款異常、未出貨", "報修"),
          menuButton("合作放機", "申請場地合作", "合作"),
          menuButton("聯絡客服", "找人工客服協助", "客服")
        ]
      }
    }
  };
}

function menuButton(label, description, messageText) {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "12px",
    backgroundColor: "#F5F5F5",
    cornerRadius: "md",
    action: { type: "message", label, text: messageText },
    contents: [
      { type: "text", text: label, weight: "bold", size: "md", color: "#111111" },
      { type: "text", text: description, size: "sm", color: "#666666", margin: "xs" }
    ]
  };
}

app.listen(PORT, () => {
  console.log(`新刃智能販賣機商城 LINE Bot V3 running on port ${PORT}`);
});
