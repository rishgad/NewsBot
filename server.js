// server.js (Backend server)
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

// === Route: Fetch articles from NewsAPI ===
app.get('/news', async (req, res) => {
  try {
    const newsRes = await fetch(`https://newsapi.org/v2/everything?${new URLSearchParams({
      q: 'decentralized AI',
      language: 'en',
      pageSize: '5',
      sortBy: 'publishedAt',
      apiKey: process.env.REACT_APP_NEWS_API_KEY,
    })}`);
    const data = await newsRes.json();
    res.json(data);
  } catch (err) {
    console.error('❌ Error fetching news:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// === Route: Fetch article metadata from a URL ===
app.post('/fetchArticle', async (req, res) => {
  try {
    const { url } = req.body;
    const pageRes = await fetch(url);
    const html = await pageRes.text();

    const title = (html.match(/<title>(.*?)<\/title>/i) || [])[1] || url;
    let desc = '';
    const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
    if (metaMatch) {
      desc = metaMatch[1];
    } else {
      const pMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
      if (pMatch) {
        desc = pMatch[1].replace(/<[^>]+>/g, '').slice(0, 200);
      }
    }

    res.json({ title, desc });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch article metadata' });
  }
});

// === Route: Summarize article text ===
app.post('/summarize', async (req, res) => {
  try {
    const { text } = req.body;
    const hfRes = await fetch('https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.HF_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text, parameters: { max_length: 60, min_length: 20 } }),
    });
    const summaryData = await hfRes.json();
    res.json({ summary: summaryData[0].summary_text });
  } catch (err) {
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// === Route: Send to Telegram ===
app.post('/sendTelegram', async (req, res) => {
  try {
    const { articles } = req.body;
    const msg = articles.map((a, i) =>
      `${i + 1}. [${a.title}](${a.url})\n_${a.summary}_`
    ).join('\n\n');

    const tgRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: process.env.TELEGRAM_CHAT_ID,
        text: msg,
        parse_mode: 'Markdown',
      }),
    });

    const tgJson = await tgRes.json();
    if (!tgJson.ok) throw new Error(tgJson.description);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Start server ===
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
