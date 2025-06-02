import React, { useState, useEffect } from 'react';

export default function App() {
  // 1) Keep a “draftArticles” list of { title, desc, url } for review mode
  const [draftArticles, setDraftArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(true);

  // For the “Add by URL” form:
  const [newUrl, setNewUrl] = useState('');

  // 2) Once summaries are generated, move into articles array
  const [articles, setArticles] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        // Fetch top 5 “decentralized AI” stories from NewsAPI
        const news = await fetch(
          `https://newsapi.org/v2/everything?${new URLSearchParams({
            q: 'decentralized AI',
            language: 'en',
            pageSize: '5',
            sortBy: 'publishedAt',
            apiKey: process.env.REACT_APP_NEWS_API_KEY,
          })}`
        ).then((res) => res.json());

        // Initialize draftArticles with { title, desc, url }
        const initialDrafts = news.articles.map((art) => ({
          title: art.title,
          desc: art.description || art.content || art.title || '',
          url: art.url,
        }));
        setDraftArticles(initialDrafts);
      } catch (err) {
        console.error('Error loading news:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Remove a draft by index
  const removeDraft = (idx) => {
    setDraftArticles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Add a new draft by URL: call /fetchArticle to get title+desc
  const addByUrl = async () => {
    if (!newUrl.trim()) {
      alert('Please paste a URL first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/fetchArticle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }
      // json should be { title, desc }
      setDraftArticles((prev) => [
        ...prev,
        { title: json.title, desc: json.desc, url: newUrl.trim() },
      ]);
      setNewUrl('');
    } catch (err) {
      console.error('Error fetching article metadata:', err);
      alert('❌ Failed to fetch the URL. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Once done reviewing, run /summarize on each desc and switch modes
  const generateSummaries = async () => {
    setLoading(true);
    try {
      const withSummaries = await Promise.all(
        draftArticles.map(async (art) => {
          const sumRes = await fetch('/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: art.desc }),
          });
          const { summary } = await sumRes.json();
          return {
            title: art.title,
            url: art.url,
            summary,
            isEditing: false,
          };
        })
      );
      setArticles(withSummaries);
      setReviewMode(false);
    } catch (err) {
      console.error('Error generating summaries:', err);
    } finally {
      setLoading(false);
    }
  };

  // Edit/save a summary in the final list
  const toggleEdit = (idx) => {
    setArticles((a) =>
      a.map((art, i) => (i === idx ? { ...art, isEditing: !art.isEditing } : art))
    );
  };

  const updateSummary = (idx, text) => {
    setArticles((a) =>
      a.map((art, i) => (i === idx ? { ...art, summary: text } : art))
    );
  };

  // Send to Telegram
  const sendToTelegram = async () => {
    try {
      const res = await fetch('/sendTelegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles }),
      });
      const json = await res.json();
      if (json.ok) {
        alert('✅ Sent to Telegram!');
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error sending to Telegram:', err);
      alert('❌ Failed to send to Telegram: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <p className="text-center text-lg">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">
        Decentralized AI News
      </h1>

      {reviewMode ? (
        // ── REVIEW MODE: list of fetched drafts + “Add by URL” ───────────
        <>
          <p className="text-center mb-4">
            Remove any unwanted items or add your own URL below before summarizing.
          </p>

          <div className="space-y-4 mb-8">
            {draftArticles.map((art, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow p-4 flex justify-between items-start"
              >
                <div>
                  <h2 className="text-xl font-semibold">{art.title}</h2>
                  <p className="text-gray-600 mt-1">
                    {art.desc.slice(0, 120)}
                    {art.desc.length > 120 ? '…' : ''}
                  </p>
                  <p className="text-blue-500 text-sm mt-1 break-all">
                    {art.url}
                  </p>
                </div>
                <button
                  onClick={() => removeDraft(idx)}
                  className="text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Add by URL input */}
          <div className="mb-8 bg-white rounded-2xl shadow p-6">
            <h2 className="text-2xl font-semibold mb-4">Add by URL</h2>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full border rounded p-2 mb-4"
              placeholder="Paste any article URL here"
            />
            <button
              onClick={addByUrl}
              className="px-6 py-2 bg-green-600 text-white rounded-2xl hover:bg-green-700 transition"
            >
              Add URL
            </button>
          </div>

          {/* Generate Summaries button */}
          <div className="text-center">
            <button
              onClick={generateSummaries}
              className="px-6 py-2 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition"
            >
              Generate Summaries
            </button>
          </div>
        </>
      ) : (
        // ── SUMMARY MODE: show summaries + “Send to Telegram” ───────────
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((art, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl shadow p-4 flex flex-col"
              >
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-semibold hover:underline"
                >
                  {art.title}
                </a>
                {art.isEditing ? (
                  <textarea
                    value={art.summary}
                    onChange={(e) => updateSummary(idx, e.target.value)}
                    className="mt-4 border rounded p-2 flex-grow"
                  />
                ) : (
                  <p className="mt-4 flex-grow text-gray-700">
                    {art.summary}
                  </p>
                )}
                <button
                  onClick={() => toggleEdit(idx)}
                  className="mt-4 self-end px-4 py-2 rounded-2xl shadow hover:shadow-md transition"
                >
                  {art.isEditing ? 'Save' : 'Edit'}
                </button>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={sendToTelegram}
              className="px-6 py-2 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition"
            >
              Send to Telegram
            </button>
          </div>
        </>
      )}
    </div>
  );
}
