export default async function handler(req, res) {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing NEWS_API_KEY' });
    }
  
    const url = `https://newsapi.org/v2/everything?q=decentralized AI&language=en&pageSize=5&sortBy=publishedAt&apiKey=${apiKey}`;
  
    try {
      const newsRes = await fetch(url);
      const data = await newsRes.json();
      res.status(200).json(data);
    } catch (err) {
      console.error('API fetch error:', err);
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  }
  