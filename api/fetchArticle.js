export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  try {
    const page = await fetch(url);
    const html = await page.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : url;

    const metaDescMatch = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    );
    let desc = metaDescMatch?.[1];
    if (!desc) {
      const p = html.match(/<p[^>]*>(.*?)<\/p>/i);
      desc = p ? p[1].replace(/<[^>]+>/g, '').slice(0, 200) : '';
    }

    // Try to extract source from meta tags
    const sourceMatch =
      html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
    const source = sourceMatch ? sourceMatch[1] : 'Unknown Source';

    // Try to extract published date from meta tags or <time> element
    const dateMatch =
      html.match(/<meta\s+property=["']article:published_time["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<time\s+datetime=["']([^"']+)["']/i);
    const publishedAt = dateMatch ? dateMatch[1] : '';

    res.status(200).json({ title, desc, source, publishedAt });
  } catch (err) {
    console.error('fetchArticle error:', err);
    res.status(500).json({ error: 'Could not fetch article' });
  }
}
