const express = require('express');
const app = express();
const PORT = process.env.PORT && process.env.PORT !== '57267' ? process.env.PORT : 6000;


// Example API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express!' });
});

// Add this route to handle /api/news
app.get('/api/news', (req, res) => {
  // This is just a sample response; replace it with your actual news fetching logic
  res.json({
    articles: [
      {
        title: "Sample News Title",
        description: "This is a sample news description.",
        url: "https://example.com/news/sample-news",
        source: "Sample Source",
        publishedAt: new Date().toISOString(),
      },
    ],
  });
});

app.listen(PORT, () => {
  console.log(`⚡ Server running on http://localhost:${PORT}`);
});
