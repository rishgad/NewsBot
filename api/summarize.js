import { getJson } from 'serpapi';

export default async function handler(req, res) {
  const serpApiKey = process.env.SERP_API_KEY;

  if (!serpApiKey) {
    return res.status(500).json({ error: 'Missing SERP_API_KEY' });
  }

  try {
    getJson(
      {
        engine: 'google_news',
        hl: 'en',
        gl: 'us',
        q: '(crypto AND AI) OR (blockchain AND AI) OR "decentralized AI"',
        tbs: 'qdr:d', // only past 24 hours
        api_key: serpApiKey,
      },
      (json) => {
        const articles = (json.news_results || []).slice(0, 10).map((art) => ({
          title: art.title,
          url: art.link,
          desc: art.snippet || art.title,
        }));

        res.status(200).json({ articles });
      }
    );
  } catch (err) {
    console.error('❌ SerpAPI error:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
