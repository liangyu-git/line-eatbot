require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then(() => res.end());
});

async function handleEvent(event) {
  if (event.type !== 'message') return null;

  const msg = event.message;

  if (msg.type === 'text') {
    if (msg.text.includes('吃') || msg.text.includes('餓')) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '請傳送你的定位資訊，我幫你找附近好吃的 🍜',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'location',
                label: '傳送位置 📍',
              },
            },
          ],
        },
      });
    }
  } else if (msg.type === 'location') {
    const { latitude, longitude } = msg;

    const radius = 1000; // 初始半徑（公尺）
    const foodType = ''; // 之後可讓使用者指定類型
    const excludeKeywords = ['麵']; // 篩掉含「麵」字樣

    const res = await axios.get(`https://maps.googleapis.com/maps/api/place/nearbysearch/json`, {
      params: {
        location: `${latitude},${longitude}`,
        radius,
        type: 'restaurant',
        keyword: foodType,
        key: process.env.GOOGLE_API_KEY,
      },
    });

    const places = res.data.results
      .filter(p => p.rating >= 4.2 && p.user_ratings_total >= 50)
      .filter(p => !excludeKeywords.some(k => (p.name + p.vicinity).includes(k)))
      .slice(0, 3);

    if (places.length === 0) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '附近找不到符合的餐廳，可以再傳一次位置，我會擴大範圍試試！',
      });
    }

    const messages = places.map(p => ({
      type: 'text',
      text: `🍽 ${p.name}\n⭐ ${p.rating} 分（${p.user_ratings_total} 則評論）\n📍 ${p.vicinity}\n📌 https://maps.google.com/?q=${p.geometry.location.lat},${p.geometry.location.lng}`,
    }));

    return client.replyMessage(event.replyToken, messages);
  }

  return null;
}

app.listen(port, () => {
  console.log(`LINE Bot is running on port ${port}`);
});
