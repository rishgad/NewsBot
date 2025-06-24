import { getJson } from "serpapi";

export default async function handler(req, res) {
  const serpApiKey = process.env.SERP_API_KEY;

  if (!serpApiKey) {
    return res.status(500).json({ error: 'Missing SERP_API_KEY' });
  }

  const query = '(crypto AND AI) OR (blockchain AND AI) OR "decentralized AI"';

  const fetchSerpApiResults = () => {
    return new Promise((resolve, reject) => {
      getJson(
        {
          engine: "google_news",
          hl: "en",
          gl: "us",
          q: query,
          tbs: "qdr:d",
          api_key: serpApiKey,
        },
        (json) => {
          if (!json || json.error) {
            reject(json?.error || "Failed to fetch SerpAPI results");
          } else {
            resolve(json);
          }
        }
      );
    });
  };

  try {
    const data = await fetchSerpApiResults();
  
    if (!data.news_results || !Array.isArray(data.news_results)) {
      return res.status(500).json({ error: 'API response does not contain a valid news_results array!' });
    }
  
    const articles = data.news_results
      .slice(0, 10)
      .map((item) => ({
        title: item.title,
        description: item.snippet || '',
        url: item.link,
        source: item.source || '',
        publishedAt: item.date || '',
      }));
  
    res.status(200).json({ articles });
  } catch (err) {
    console.error('❌ SerpAPI fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch news from SerpAPI' });
  }  
}
