export default async function handler(req, res) {
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
  
      res.status(200).json({ title, desc });
    } catch (err) {
      res.status(500).json({ error: 'Could not fetch article' });
    }
  }
  