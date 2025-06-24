import { getJson } from "serpapi";

export default async function handler(req, res) {
  const serpApiKey = process.env.SERP_API_KEY;


  if (!serpApiKey) {
    return res.status(500).json({ error: 'Missing SERP_API_KEY' });
  }

  const query = '(crypto AND AI) OR (blockchain AND AI) OR "decentralized AI"';

  // Wrap SerpAPI call in a Promise so we can use async/await
  const fetchSerpApiResults = () => {
    return new Promise((resolve, reject) => {
      getJson({
        engine: "google_news",
        hl: "en",
        gl: "us",
        q: query,
        tbs: "qdr:d",
        api_key: serpApiKey
      }, (json) => {
        if (!json || json.error) {
          reject(json?.error || "Failed to fetch SerpAPI results");
        } else {
          resolve(json);
        }
      });
    });
  };

  try {
    const data = await fetchSerpApiResults();
    res.status(200).json(data);
  } catch (err) {
    console.error('❌ SerpAPI fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch news from SerpAPI' });
  }
}
