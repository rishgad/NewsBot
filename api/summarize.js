export default async function handler(req, res) {
    const HF_API_KEY = process.env.HF_API_KEY;
    const { text } = req.body;
  
    try {
      const response = await fetch(
        'https://api-inference.huggingface.co/models/facebook/bart-large-cnn',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${HF_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ inputs: text }),
        }
      );
  
      const result = await response.json();
      const summary = result[0]?.summary_text;
  
      if (!summary) throw new Error('Missing summary');
      res.status(200).json({ summary });
    } catch (e) {
      res.status(500).json({ error: 'Summarization failed' });
    }
  }
  