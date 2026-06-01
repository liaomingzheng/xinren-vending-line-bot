require("dotenv").config();

const express = require("express");
const path = require("path");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://xinren-vending-line-bot.onrender.com";
const SHOP_URL = process.env.SHOP_URL || "https://line.me";
const LOCATION_URL = process.env.LOCATION_URL || `${PUBLIC_BASE_URL}/locations?v=5`;
const STOCK_FORM_URL = process.env.STOCK_FORM_URL || "https://forms.gle";
const REPAIR_FORM_URL = process.env.REPAIR_FORM_URL || "https://forms.gle";
const PARTNER_FORM_URL = process.env.PARTNER_FORM_URL || "https://forms.gle";

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.send("新刃智能販賣機商城 LINE Bot is running.");
});

app.get("/locations", (req, res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(__dirname, "public", "locations.html"));
});

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events || [];
    await Promise.all(events.map(handleEvent));
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

  if (matchKeyword(userText, ["據點", "位置", "地圖", "導航", "機台", "在哪", "地址", "附近"])) {
    return replyMessage(event.replyToken, locationMessage());
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
      "這裡可以查詢商品、機台地圖、缺貨回報、故障報修與合作放機。\n\n" +
      "請點選下方功能，或直接輸入：商城、據點、缺貨、報修、合作、客服"
    ),
    mainMenuFlex()
  ];
}

function mainMenuMessage() {
  return [
    textMessage("請選擇您需要的服務。"),
    mainMenuFlex()
  ];
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
          menuButton("機台地圖", "像租車據點一樣選機台導航", "據點"),
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

function shopMessage() {
  return [
    textMessage("請點選下方按鈕進入商品商城。"),
    {
      type: "template",
      altText: "商品商城",
      template: {
        type: "buttons",
        title: "新刃智能販賣機商城",
        text: "查看販賣機商品",
        actions: [{ type: "uri", label: "進入商品商城", uri: SHOP_URL }]
      }
    }
  ];
}

function locationMessage() {
  return [
    textMessage("請點選下方按鈕開啟機台地圖。打開後可以像租車據點一樣，直接在地圖上選擇要前往的販賣機。"),
    {
      type: "template",
      altText: "機台地圖",
      template: {
        type: "buttons",
        title: "機台地圖",
        text: "查看附近機台並選擇導航",
        actions: [
          { type: "uri", label: "開啟機台地圖", uri: LOCATION_URL },
          { type: "message", label: "故障報修", text: "報修" },
          { type: "message", label: "缺貨回報", text: "缺貨" }
        ]
      }
    }
  ];
}

function stockMessage() {
  return [
    textMessage(
      "缺貨回報格式：\n\n" +
      "機台編號：\n" +
      "缺貨商品：\n" +
      "貨道編號：\n" +
      "現場照片：\n\n" +
      "也可以點下方按鈕填寫表單。"
    ),
    {
      type: "template",
      altText: "缺貨回報",
      template: {
        type: "buttons",
        title: "缺貨回報",
        text: "請填寫缺貨回報表單",
        actions: [{ type: "uri", label: "填寫缺貨回報", uri: STOCK_FORM_URL }]
      }
    }
  ];
}

function repairMessage() {
  return [
    textMessage(
      "故障報修格式：\n\n" +
      "機台編號：\n" +
      "問題類型：卡貨／付款異常／未出貨／取物門異常／其他\n" +
      "發生時間：\n" +
      "付款方式：\n" +
      "照片或付款紀錄：\n\n" +
      "也可以點下方按鈕填寫表單。"
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
          { type: "message", label: "卡貨／未出貨", text: "我要報修：卡貨或未出貨" },
          { type: "message", label: "付款異常", text: "我要報修：付款異常" }
        ]
      }
    }
  ];
}

function partnerMessage() {
  return [
    textMessage(
      "歡迎申請智能販賣機合作放置。\n\n" +
      "請提供：店名／公司名、預計放置地址、場地類型、每日人流、是否可提供電源、聯絡人與電話。"
    ),
    {
      type: "template",
      altText: "合作放機",
      template: {
        type: "buttons",
        title: "合作放機申請",
        text: "申請放置新刃智能販賣機",
        actions: [{ type: "uri", label: "填寫合作申請", uri: PARTNER_FORM_URL }]
      }
    }
  ];
}

function customerServiceMessage() {
  return textMessage(
    "您好，請直接留下您的問題。\n\n" +
    "若是機台問題，請提供機台編號、機台位置、問題描述、現場照片或付款紀錄。"
  );
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`新刃智能販賣機商城 LINE Bot running on port ${port}`);
});
