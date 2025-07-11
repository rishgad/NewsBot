import { getJson } from "serpapi";
import { sanitizeSerpApiArticle } from "./src/serpApiHelper";

export default async function handler(req, res) {
  const serpApiKey = process.env.SERP_API_KEY;
  if (!serpApiKey) {
    return res.status(500).json({ error: "Missing SERP_API_KEY" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const query = "(crypto AND AI) OR (blockchain AND AI) OR \"decentralized AI\"";

  const fetchSerpApiResults = () =>
    new Promise((resolve, reject) => {
      getJson(
        {
          tbm: "nws",
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

  try {
    const data = await fetchSerpApiResults();

    if (!data.news_results || !Array.isArray(data.news_results)) {
      return res
        .status(500)
        .json({ error: "API response missing news_results array" });
    }

    const articles = data.news_results
      .slice(0, 10)
      .map(sanitizeSerpApiArticle);

    res.status(200).json({ articles });
  } catch (err) {
    console.error("❌ SerpAPI fetch error:", err);
    res.status(500).json({ error: "Failed to fetch news from SerpAPI" });
  }
}
