// server.js
require('dotenv').config();
console.log('🔑  HF_API_KEY loaded?       ', !!process.env.HF_API_KEY);
console.log('🔑  TELEGRAM_BOT_TOKEN loaded?', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('🔢  TELEGRAM_CHAT_ID loaded?  ', !!process.env.TELEGRAM_CHAT_ID);

const express = require('express');
// On Node 18+, `fetch` is global. If you're on Node <18, install node-fetch@2:
//    npm install node-fetch@2
// and uncomment the next line:
// const fetch = require('node-fetch');
const app = express();
app.use(express.json());

//
// 0) New: Fetch raw HTML & extract <title> + <meta name="description">
//    Front end will POST { url } to this endpoint.
//
app.post('/fetchArticle', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Invalid or missing URL.' });
    }

    // Fetch the raw HTML
    const pageRes = await fetch(url);
    if (!pageRes.ok) {
      return res
        .status(502)
        .json({ error: `Could not fetch URL: ${pageRes.status}` });
    }
    const html = await pageRes.text();

    // Extract <title>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    // Extract <meta name="description" content="...">
    let desc = '';
    const metaDescMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    );
    if (metaDescMatch) {
      desc = metaDescMatch[1].trim();
    } else {
      // As a fallback, grab the first <p>…</p> text (strip tags), up to ~200 chars
      const pTagMatch = html.match(/<p[^>]*>(.*?)<\/p>/i);
      if (pTagMatch) {
        // Strip HTML tags inside that <p>
        desc = pTagMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 200);
      }
    }

    return res.json({ title, desc });
  } catch (err) {
    console.error('❌ fetchArticle error:', err);
    return res.status(500).json({ error: 'Failed to fetch article.' });
  }
});

//
// 1) Summarization endpoint (unchanged)
//
app.post(
  '/summarize',
  (req, res, next) => {
    console.log('🔀  POST /summarize hit; body:', req.body);
    next();
  },
  async (req, res) => {
    const text = req.body.text || '';
    try {
      console.log('⏳ Calling Hugging Face...');
      const hfRes = await fetch(
        'https://api-inference.huggingface.co/models/sshleifer/distilbart-cnn-12-6',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            inputs: text,
            parameters: { max_length: 60, min_length: 20 },
          }),
        }
      );

      console.log('🔍 HF responded with status:', hfRes.status);
      if (!hfRes.ok) {
        const errBody = await hfRes.text();
        console.error('❌ Hugging Face returned', hfRes.status, errBody);
        return res
          .status(502)
          .json({ error: `HF inference failed: ${hfRes.status}` });
      }

      const hfJson = await hfRes.json();
      if (!Array.isArray(hfJson) || !hfJson[0]?.summary_text) {
        console.error('❌ Unexpected HF response format:', hfJson);
        return res.status(502).json({ error: 'Unexpected HF response' });
      }

      console.log('✅ Summary:', hfJson[0].summary_text);
      return res.json({ summary: hfJson[0].summary_text });
    } catch (err) {
      console.error('🔥 Summarization error:', err);
      return res.status(500).json({ error: 'Summarization failed' });
    }
  }
);

//
// 2) Telegram‐send endpoint (unchanged)
//
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

app.post('/sendTelegram', async (req, res) => {
  try {
    const { articles } = req.body;
    if (!Array.isArray(articles)) {
      return res.status(400).json({ error: '`articles` must be an array' });
    }
    if (!BOT_TOKEN || !CHAT_ID) {
      throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    }

    let msg = "*Today's Decentralized-AI News*\n\n";
    articles.forEach((art, i) => {
      msg += `${i + 1}. [${art.title}](${art.url})\n_${art.summary}_\n\n`;
    });

    console.log('📢  Sending message to Telegram...');
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: msg,
          parse_mode: 'Markdown',
        }),
      }
    );

    const tgJson = await tgRes.json();
    if (!tgJson.ok) {
      throw new Error(`TG error [${tgJson.error_code}]: ${tgJson.description}`);
    }
    console.log('✅ Telegram responded with:', tgJson);
    return res.json({ ok: true, result: tgJson.result });
  } catch (err) {
    console.error('❌ sendTelegram error:', err);
    return res.status(500).json({ error: err.message });
  }
});

//
// 3) Start listening
//
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Proxy server listening on port ${PORT}`);
});
