export default async function handler(req, res) {
    const NEWS_API_KEY = process.env.NEWS_API_KEY;
    try {
      const result = await fetch(
        `https://newsapi.org/v2/everything?q=decentralized%20AI&language=en&pageSize=5&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`
      );
      const data = await result.json();
      res.status(200).json(data);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch news' });
    }
  }
  