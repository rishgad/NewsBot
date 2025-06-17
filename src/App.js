import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

export default function App() {
  const [draftArticles, setDraftArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [articles, setArticles] = useState([]);
  const [activeArticle, setActiveArticle] = useState(null);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
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
          return { title: art.title, url: art.url, summary, isEditing: false };
        })
      );
      setArticles(withSummaries);
      setReviewMode(false);
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
      if (json.ok) alert('✅ Sent to Telegram!');
      else throw new Error(json.error || 'Unknown error');
    } catch (err) {
      console.error('Error sending to Telegram:', err);
      alert('❌ Failed to send to Telegram: ' + err.message);
    }
  }, [articles]);

  const removeArticle = (index) => {
    if (reviewMode) setDraftArticles((prev) => prev.filter((_, i) => i !== index));
    else setArticles((prev) => prev.filter((_, i) => i !== index));

    const currentList = reviewMode ? draftArticles : articles;
    if (activeArticle === currentList[index]) {
      setActiveArticle(null);
      setIsEditingDesc(false);
    }
  };

  if (loading) return <div className="loading-screen"><p>Loading…</p></div>;

  const list = reviewMode ? draftArticles : articles;

  const handleSaveDesc = () => {
    setArticles((prev) =>
      prev.map((art) =>
        art === activeArticle ? { ...art, summary: editedDesc } : art
      )
    );
    setActiveArticle({ ...activeArticle, summary: editedDesc });
    setIsEditingDesc(false);
  };

  return (
    <div className="app-container">
      <h1 className="app-title">🧠 Decentralized AI News Bot</h1>

      {reviewMode && (
        <div className="top-buttons">
          <button onClick={generateSummaries} className="btn blue">⚡ Generate Summaries</button>
        </div>
      )}

      <div className="article-grid">
        {list.map((art, idx) => (
          <motion.div
            key={idx}
            layout
            className="article-card"
            whileTap={{ scale: 0.97 }}
          >
            <div
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => {
                setActiveArticle(art);
                setIsEditingDesc(false);
                setEditedDesc(reviewMode ? art.desc : art.summary);
              }}
            >
              <a
                href={art.url}
                target="_blank"
                rel="noopener noreferrer"
                className="article-title-link"
                onClick={(e) => e.stopPropagation()} // prevent modal open if clicking link
              >
                {art.title}
              </a>
              <p className="article-preview">
                {reviewMode
                  ? art.desc.slice(0, 100) + (art.desc.length > 100 ? '…' : '')
                  : art.summary.slice(0, 100) + (art.summary.length > 100 ? '…' : '')}
              </p>
            </div>

            <button
              className="remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                removeArticle(idx);
              }}
              aria-label="Remove article"
            >
              Remove
            </button>
          </motion.div>
        ))}
      </div>

      {reviewMode && (
        <div className="input-area-bottom">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="url-input"
            placeholder="Paste article URL here"
          />
          <button onClick={addByUrl} className="btn green">➕ Add Article by URL</button>
        </div>
      )}

      <AnimatePresence>
        {activeArticle && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              layout
              className="modal-content"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
            >
              <button
                onClick={() => setActiveArticle(null)}
                className="modal-close"
              >
                &times;
              </button>
              <h2 className="modal-title">{activeArticle.title}</h2>
              {!reviewMode && isEditingDesc ? (
                <>
                  <textarea
                    className="url-input"
                    value={editedDesc}
                    onChange={(e) => setEditedDesc(e.target.value)}
                  />
                  <button className="btn green" onClick={handleSaveDesc}>💾 Save</button>
                </>
              ) : (
                <p className="modal-desc">{reviewMode ? activeArticle.desc : activeArticle.summary}</p>
              )}
              {!reviewMode && !isEditingDesc && (
                <button className="btn blue" onClick={() => setIsEditingDesc(true)}>✏️ Edit Summary</button>
              )}
              <a
                href={activeArticle.url}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-link"
              >
                🌐 Read Full Article
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!reviewMode && (
        <div className="footer">
          <button onClick={() => setReviewMode(true)} className="btn gray">🔙 Go Back</button>
          <button onClick={sendToTelegram} className="btn purple">📤 Send to Telegram</button>
        </div>
      )}
    </div>
  );
}
