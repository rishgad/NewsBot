// utils/serpApiHelper.js
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      console.warn('⚠️ Invalid date string:', dateStr);
      return null;
    }
    return parsed;
  }
  
  function sanitizeSerpApiArticle(item) {
    const source = item.source || 'Unknown Source';
  
    // SerpAPI sometimes puts date in different fields, fallback accordingly
    const rawDate = item.date || item.published_at || item.publishedAt || '';
  
    const date = parseDate(rawDate);
  
    // Log any bad data for tracking
    if (!item.title) console.warn('⚠️ Missing title in article:', item);
    if (!source || source === 'Unknown Source') console.warn('⚠️ Missing source in article:', item);
    if (rawDate && !date) console.warn('⚠️ Bad published date in article:', item);
  
    return {
      title: item.title || 'No title',
      description: item.snippet || item.description || '',
      url: item.link || item.url || '',
      source,
      publishedAt: date ? date.toISOString() : '',
      incompleteData: !date || source === 'Unknown Source' || !item.title,
    };
  }
  
  export { sanitizeSerpApiArticle };
  