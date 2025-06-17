import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import './App.css';

export default function App() {
  const [draftArticles, setDraftArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState([]);
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
      setDraftArticles((prev) => [...prev, { title: json.title, desc: json.desc, url: newUrl.trim() }]);
      setNewUrl('');
    } catch (err) {
      console.error('Error fetching article metadata:', err);
      alert('❌ Failed to fetch the URL.');
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
          return { title: art.title, url: art.url, summary };
        })
      );
      setArticles(withSummaries);
      setSelected(withSummaries.map(() => true));
      setReviewMode(false);
    } catch (err) {
      console.error('Error generating summaries:', err);
    } finally {
      setLoading(false);
    }
  }, [draftArticles]);

  const sendToTelegram = useCallback(async () => {
    const selectedArticles = articles.filter((_, i) => selected[i]);
    if (selectedArticles.length === 0) {
      alert('⚠️ Please select at least one article to send.');
      return;
    }
    try {
      const res = await fetch('/api/sendTelegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: selectedArticles }),
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
  }, [articles, selected]);

  const removeArticle = (idx) => {
    if (reviewMode) {
      const newDrafts = [...draftArticles];
      newDrafts.splice(idx, 1);
      setDraftArticles(newDrafts);
    } else {
      const newArticles = [...articles];
      const newSelected = [...selected];
      newArticles.splice(idx, 1);
      newSelected.splice(idx, 1);
      setArticles(newArticles);
      setSelected(newSelected);
    }
  };

  const toggleSelectAll = () => {
    const allSelected = selected.every(Boolean);
    setSelected(articles.map(() => !allSelected));
  };

  const list = reviewMode ? draftArticles : articles;

  return (
    <div className="app-container">
      <h1 className="app-title">🧠 Decentralized AI News Bot</h1>
  
      {!reviewMode && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem' }}>
          <button onClick={toggleSelectAll} className="btn gray">✅ Select All</button>
          <button
            onClick={() => setSelected(articles.map(() => false))}
            className="btn gray"
          >
            🚫 Deselect All
          </button>
        </div>
      )}
  
      <div className="article-grid">
        {list.map((art, idx) => (
          <motion.div key={idx} layout className="article-card">
            <div className="article-header">
              <a href={art.url} target="_blank" rel="noopener noreferrer" className="article-title-link">
                {art.title}
              </a>
              {!reviewMode && (
                <input
                  type="checkbox"
                  checked={selected[idx] || false}
                  onChange={(e) => {
                    const updated = [...selected];
                    updated[idx] = e.target.checked;
                    setSelected(updated);
                  }}
                  title="Select article"
                />
              )}
              <button className="btn red remove-btn" onClick={() => removeArticle(idx)}>
                ❌ Remove
              </button>
            </div>
            {!reviewMode && isEditingDescIndex === idx ? (
              <>
                <textarea
                  className="url-input"
                  value={editedDesc}
                  onChange={(e) => setEditedDesc(e.target.value)}
                />
                <button
                  className="btn green"
                  onClick={() => {
                    const updated = [...articles];
                    updated[idx].summary = editedDesc;
                    setArticles(updated);
                    setIsEditingDescIndex(null);
                  }}
                >
                  💾 Save
                </button>
              </>
            ) : (
              <p className="article-desc">
                {reviewMode ? art.desc.slice(0, 150) + '...' : art.summary}
              </p>
            )}
            {!reviewMode && isEditingDescIndex !== idx && (
              <button
                className="btn blue"
                onClick={() => {
                  setEditedDesc(articles[idx].summary);
                  setIsEditingDescIndex(idx);
                }}
              >
                ✏️ Edit
              </button>
            )}
          </motion.div>
        ))}
      </div>
  
      {reviewMode ? (
        <div className="bottom-controls">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="url-input"
            placeholder="Paste article URL here"
          />
          <button onClick={addByUrl} className="btn green">➕ Add Article</button>
          <button onClick={generateSummaries} className="btn blue big" disabled={loading}>
            {loading ? '⏳ Summarizing...' : '⚡ Generate Summaries'}
          </button>
        </div>
      ) : (
        <div className="footer">
          <button onClick={toggleSelectAll} className="btn gray">🟢 Toggle Select All</button>
          <button onClick={() => setReviewMode(true)} className="btn gray">🔙 Back</button>
          <button onClick={sendToTelegram} className="btn purple">📤 Send to Telegram</button>
        </div>
      )}
    </div>
  );
}  
