import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import './App.css';

export default function App() {
  const [draftArticles, setDraftArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [articles, setArticles] = useState([]);
  const [isEditingDescIndex, setIsEditingDescIndex] = useState(null);
  const [editedDesc, setEditedDesc] = useState('');

  const fetchInitialArticles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news');
      const news = await response.json();
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
  }, []);

  useEffect(() => {
    fetchInitialArticles();
  }, [fetchInitialArticles]);

  const addByUrl = useCallback(async () => {
    if (!newUrl.trim()) {
      alert('Please paste a URL first.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/fetchArticle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: newUrl.trim() }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
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
  }, [newUrl]);

  const generateSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const withSummaries = await Promise.all(
        draftArticles.map(async (art) => {
          const sumRes = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: art.desc }),
          });
          const { summary } = await sumRes.json();
          return {
            title: art.title,
            url: art.url,
            summary,
          };
        })
      );
      setArticles(withSummaries);
      setReviewMode(false);
      setIsEditingDescIndex(null);
    } catch (err) {
      console.error('Error generating summaries:', err);
    } finally {
      setLoading(false);
    }
  }, [draftArticles]);

  const sendToTelegram = useCallback(async () => {
    try {
      const res = await fetch('/api/sendTelegram', {
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
  }, [articles]);

  // Remove article by index
  const removeArticle = (index) => {
    if (reviewMode) {
      setDraftArticles((prev) => prev.filter((_, i) => i !== index));
    } else {
      setArticles((prev) => prev.filter((_, i) => i !== index));
      if (isEditingDescIndex === index) setIsEditingDescIndex(null);
    }
  };

  const handleSaveDesc = (index) => {
    setArticles((prev) =>
      prev.map((art, i) =>
        i === index ? { ...art, summary: editedDesc } : art
      )
    );
    setIsEditingDescIndex(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading…</p>
      </div>
    );
  }

  const list = reviewMode ? draftArticles : articles;

  return (
    <div className="app-container">
      <h1 className="app-title">🧠 Decentralized AI News Bot</h1>

      <div className="article-grid">
        {list.map((art, idx) => (
          <motion.div
            key={idx}
            layout
            className="article-card"
          >
            <div className="article-header">
              <a
                href={art.url}
                target="_blank"
                rel="noopener noreferrer"
                className="article-title-link"
              >
                {art.title}
              </a>
              <button
                className="btn red remove-btn"
                onClick={() => removeArticle(idx)}
                aria-label={`Remove article ${art.title}`}
              >
                ❌ Remove
              </button>
            </div>

            <p className="article-preview">
              {reviewMode ? (
                art.desc.slice(0, 100) + (art.desc.length > 100 ? '…' : '')
              ) : isEditingDescIndex === idx ? (
                <>
                  <textarea
                    className="url-input"
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                  />
                  <div className="edit-buttons">
                    <button
                      className="btn green"
                      onClick={() => handleSaveDesc(idx)}
                    >
                      💾 Save
                    </button>
                    <button
                      className="btn gray"
                      onClick={() => setIsEditingDescIndex(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {art.summary}
                  <button
                    className="btn blue edit-btn"
                    onClick={() => {
                      setIsEditingDescIndex(idx);
                      setEditedDesc(art.summary);
                    }}
                  >
                    ✏️ Edit
                  </button>
                </>
              )}
            </p>
          </motion.div>
        ))}
      </div>

      {reviewMode ? (
        <div className="input-area bottom-area">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="url-input"
            placeholder="Paste article URL here"
          />
          <button onClick={addByUrl} className="btn green">
            ➕ Add Article by URL
          </button>
          <button onClick={generateSummaries} className="btn blue big-btn">
            ⚡ Generate Summaries
          </button>
        </div>
      ) : (
        <div className="footer">
          <button onClick={() => setReviewMode(true)} className="btn gray">
            🔙 Go Back
          </button>
          <button onClick={sendToTelegram} className="btn purple">
            📤 Send to Telegram
          </button>
        </div>
      )}
    </div>
  );
}
