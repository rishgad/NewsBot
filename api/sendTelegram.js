export default async function handler(req, res) {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
    const { articles } = req.body;

    try {
      const message = articles
        .map((a, i) => `[${a.title}](${a.url})\n_${a.summary}_\n`)
        .join('\n');
  
      const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: CHAT_ID,
            text: `${message}`,
            parse_mode: 'Markdown',
          }),
        }
      );
  
      const json = await response.json();
      if (!json.ok) throw new Error(json.description);
  
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
  