require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const requiredEnv = ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`警告：尚未設定環境變數 ${key}`);
  }
}

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || "",
  channelSecret: process.env.LINE_CHANNEL_SECRET || ""
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ""
});

const URLS = {
  shop: process.env.SHOP_URL || "https://example.com/shop",
  location: process.env.LOCATION_URL || "https://example.com/location",
  stock: process.env.STOCK_FORM_URL || "https://example.com/stock-report",
  repair: process.env.REPAIR_FORM_URL || "https://example.com/repair-report",
  partner: process.env.PARTNER_FORM_URL || "https://example.com/partner-application"
};


const vendingMachines = [
  {
    id: "F6380162C464EF",
    name: "otto",
    address: "南投縣埔里鎮桃迷里大學路一號",
    note: "1樓大廳／門口右側"
  },
  {
    id: "F638C49405968C",
    name: "otto",
    address: "南投縣埔里鎮桃迷里大學路一號",
    note: "1樓大廳／門口右側"
  }
];

function googleMapUrl(address) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const SERVICE_PHONE = process.env.SERVICE_PHONE || "請直接在 LINE 留言，客服會盡快回覆。";

app.get("/", (req, res) => {
  res.status(200).send("新刃智能販賣機商城 LINE Bot is running.");
});

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "xinren-vending-line-bot" });
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
    return reply(event.replyToken, welcomeMessage());
  }

  if (event.type === "postback") {
    return handlePostback(event);
  }

  if (event.type !== "message") {
    return Promise.resolve(null);
  }

  if (event.message.type !== "text") {
    return reply(event.replyToken, text("目前請使用文字訊息操作喔。\n\n你可以輸入：商城、據點、缺貨、報修、合作、客服。"));
  }

  const msg = normalize(event.message.text);

  if (has(msg, ["商城", "商品", "購買", "買", "甜點", "飲料", "零食", "預購"])) {
    return reply(event.replyToken, shopMessage());
  }

  if (has(msg, ["據點", "位置", "地點", "機台", "在哪", "地址", "地圖"])) {
    return reply(event.replyToken, locationMessage());
  }

  if (has(msg, ["缺貨", "補貨", "沒貨", "商品沒了", "空了"])) {
    return reply(event.replyToken, stockMessage());
  }

  if (has(msg, ["報修", "故障", "卡貨", "未出貨", "沒出貨", "付款異常", "取物門", "升降台", "履帶", "螢幕", "退費", "退款"])) {
    return reply(event.replyToken, repairMessage());
  }

  if (has(msg, ["合作", "放機", "場地", "招商", "寄售", "放置", "合作放機"])) {
    return reply(event.replyToken, partnerMessage());
  }

  if (has(msg, ["客服", "聯絡", "電話", "人工", "人員", "店家"])) {
    return reply(event.replyToken, customerServiceMessage());
  }

  if (has(msg, ["選單", "menu", "功能", "開始", "help"])) {
    return reply(event.replyToken, mainMenuMessage());
  }

  return reply(event.replyToken, unknownMessage());
}

async function handlePostback(event) {
  const data = event.postback && event.postback.data;
  const map = {
    shop: shopMessage,
    location: locationMessage,
    stock: stockMessage,
    repair: repairMessage,
    partner: partnerMessage,
    customer: customerServiceMessage,
    menu: mainMenuMessage
  };
  const fn = map[data] || mainMenuMessage;
  return reply(event.replyToken, fn());
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function has(textValue, keywords) {
  return keywords.some(k => textValue.includes(k.toLowerCase()));
}

function reply(replyToken, messages) {
  const payload = Array.isArray(messages) ? messages : [messages];
  return client.replyMessage({ replyToken, messages: payload });
}

function text(message) {
  return { type: "text", text: message };
}

function welcomeMessage() {
  return [
    text(
      "歡迎來到「新刃智能販賣機商城」\n\n" +
      "這裡可以查詢商品、機台據點、缺貨回報、故障報修與合作放機。\n\n" +
      "請點選下方功能，或直接輸入：商城、據點、缺貨、報修、合作、客服。"
    ),
    mainMenuFlex()
  ];
}

function mainMenuMessage() {
  return [
    text(
      "請選擇您需要的服務：\n\n" +
      "1. 商品商城\n" +
      "2. 機台據點\n" +
      "3. 缺貨回報\n" +
      "4. 故障報修\n" +
      "5. 合作放機\n" +
      "6. 聯絡客服"
    ),
    mainMenuFlex()
  ];
}

function unknownMessage() {
  return [
    text(
      "我收到您的訊息了。\n\n" +
      "如果要快速操作，可以輸入：\n" +
      "商城、據點、缺貨、報修、合作、客服。"
    ),
    mainMenuFlex()
  ];
}

function shopMessage() {
  return [
    text(
      "這裡是「新刃智能販賣機商城」。\n\n" +
      "您可以查看販賣機商品、熱門商品、限定商品與預購商品。\n\n" +
      "若要查詢指定機台商品，請提供機台編號或所在地點。"
    ),
    buttons("新刃智能販賣機商城", "請選擇商品服務", [
      uriAction("進入商品商城", URLS.shop),
      messageAction("查詢機台商品", "我要查詢機台商品")
    ])
  ];
}

function locationMessage() {
  const locationText =
    "新刃智能販賣機據點\n\n" +
    vendingMachines.map((machine, index) => {
      return (
        `${index + 1}. ${machine.name}\n` +
        `機台編號：${machine.id}\n` +
        `地址：${machine.address}\n` +
        `備註：${machine.note}\n` +
        `地圖：${googleMapUrl(machine.address)}`
      );
    }).join("\n\n");

  return [
    text(locationText),
    buttons("機台據點查詢", "查看南投埔里機台位置", [
      uriAction("開啟 Google 地圖", googleMapUrl("南投縣埔里鎮桃迷里大學路一號")),
      messageAction("我要報修", "報修"),
      messageAction("我要回報缺貨", "缺貨")
    ])
  ];
}

function stockMessage() {
  return [
    text(
      "感謝您的缺貨回報。\n\n" +
      "請提供以下資料：\n" +
      "1. 機台編號\n" +
      "2. 機台位置\n" +
      "3. 缺貨商品\n" +
      "4. 缺貨貨道，例如 A1、B3\n" +
      "5. 現場照片，若方便提供\n\n" +
      "我們收到後會安排補貨。"
    ),
    buttons("缺貨回報", "請填寫缺貨回報表單", [
      uriAction("填寫缺貨回報", URLS.stock),
      messageAction("我想直接留言", "我要回報缺貨")
    ])
  ];
}

function repairMessage() {
  return [
    text(
      "請提供以下資料，方便我們快速協助：\n\n" +
      "1. 機台編號\n" +
      "2. 機台位置\n" +
      "3. 問題類型：卡貨／付款異常／未出貨／取物門異常／升降台異常／螢幕異常／其他\n" +
      "4. 發生時間\n" +
      "5. 付款紀錄或現場照片\n\n" +
      "若付款成功但未出貨，請務必保留付款紀錄。"
    ),
    buttons("故障報修", "請選擇報修方式", [
      uriAction("填寫故障報修", URLS.repair),
      messageAction("卡貨／未出貨", "我要報修：卡貨或未出貨"),
      messageAction("付款異常", "我要報修：付款異常")
    ])
  ];
}

function partnerMessage() {
  return [
    text(
      "歡迎申請智能販賣機合作放置。\n\n" +
      "請提供以下資料：\n" +
      "1. 店名／公司名\n" +
      "2. 預計放置地址\n" +
      "3. 場地類型：商辦／社區／工廠／學校／健身房／醫院／其他\n" +
      "4. 每日人流量\n" +
      "5. 是否可提供電源\n" +
      "6. 聯絡人與電話\n\n" +
      "我們會評估後與您聯繫。"
    ),
    buttons("合作放機申請", "申請放置新刃智能販賣機", [
      uriAction("填寫合作申請", URLS.partner),
      messageAction("我要合作放機", "我要申請合作放機")
    ])
  ];
}

function customerServiceMessage() {
  return text(
    "您好，請直接留下您的問題。\n\n" +
    "若是機台問題，請提供：\n" +
    "1. 機台編號\n" +
    "2. 機台位置\n" +
    "3. 問題描述\n" +
    "4. 現場照片或付款紀錄\n\n" +
    `客服資訊：${SERVICE_PHONE}`
  );
}

function buttons(title, bodyText, actions) {
  return {
    type: "template",
    altText: title,
    template: {
      type: "buttons",
      title,
      text: bodyText,
      actions
    }
  };
}

function uriAction(label, uri) {
  return { type: "uri", label, uri };
}

function messageAction(label, messageText) {
  return { type: "message", label, text: messageText };
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
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: "新刃智能販賣機商城",
            weight: "bold",
            size: "xl",
            color: "#111111",
            wrap: true
          },
          {
            type: "text",
            text: "商品 × 據點 × 報修 × 合作放機",
            size: "sm",
            color: "#666666",
            margin: "sm",
            wrap: true
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          menuItem("商品商城", "查看販賣機商品", "shop"),
          menuItem("機台據點", "查詢販賣機位置", "location"),
          menuItem("缺貨回報", "回報商品缺貨", "stock"),
          menuItem("故障報修", "卡貨、付款異常、未出貨", "repair"),
          menuItem("合作放機", "申請場地合作", "partner"),
          menuItem("聯絡客服", "找人工客服協助", "customer")
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "也可直接輸入：商城、據點、缺貨、報修、合作、客服",
            size: "xs",
            color: "#888888",
            wrap: true
          }
        ]
      }
    }
  };
}

function menuItem(label, description, data) {
  return {
    type: "box",
    layout: "vertical",
    paddingAll: "12px",
    backgroundColor: "#F5F5F5",
    cornerRadius: "md",
    action: {
      type: "postback",
      label,
      data
    },
    contents: [
      {
        type: "text",
        text: label,
        weight: "bold",
        size: "md",
        color: "#111111"
      },
      {
        type: "text",
        text: description,
        size: "sm",
        color: "#666666",
        margin: "xs",
        wrap: true
      }
    ]
  };
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`新刃智能販賣機商城 LINE Bot running on port ${port}`);
});
