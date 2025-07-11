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
  const [sentArticles, setSentArticles] = useState([]);

  const fetchInitialArticles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/news');
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API response error:', response.status, errorText);
        throw new Error('API request failed with status ' + response.status);
      }

      const rawText = await response.text();

      let news;
      try {
        news = JSON.parse(rawText);
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.log('Raw response text:', rawText);
        throw parseError;
      }

      if (!news.articles || !Array.isArray(news.articles)) {
        console.error('API response does not contain a valid articles array!');
        setDraftArticles([]);
      } else {
        const initialDrafts = news.articles.map((art) => {
          // Check for incomplete data to show warning
          const incompleteData =
            !art.publishedAt ||
            isNaN(new Date(art.publishedAt).getTime()) ||
            !art.source;

          return {
            title: art.title,
            desc: art.description || art.content || art.title || '',
            url: art.url,
            source: art.source || 'Unknown Source',
            publishedAt: art.publishedAt || '',
            incompleteData,
          };
        });
        setDraftArticles(initialDrafts);
      }
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

      const incompleteData =
        !json.publishedAt ||
        isNaN(new Date(json.publishedAt).getTime()) ||
        !json.source;

      setDraftArticles((prev) => [
        ...prev,
        {
          title: json.title,
          desc: json.desc,
          url: newUrl.trim(),
          source: json.source || 'Unknown Source',
          publishedAt: json.publishedAt || '',
          incompleteData,
        },
      ]);
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
      const selectedArticles = draftArticles.filter((_, i) => selected[i]);
      const withSummaries = await Promise.all(
        selectedArticles.map(async (art) => {
          const sumRes = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: art.desc }),
          });
          const { summary } = await sumRes.json();

          const incompleteData =
            !art.publishedAt ||
            isNaN(new Date(art.publishedAt).getTime()) ||
            !art.source;

          return { ...art, summary, incompleteData };
        })
      );
      setArticles(withSummaries);
      setReviewMode(false);
    } catch (err) {
      console.error('Error generating summaries:', err);
    } finally {
      setLoading(false);
    }
  }, [draftArticles, selected]);

  const sendSingleToTelegram = useCallback(
    async (article) => {
      try {
        const res = await fetch('/api/sendTelegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles: [article] }),
        });
        const json = await res.json();
        if (json.ok) {
          setArticles((prev) => prev.filter((a) => a.url !== article.url));
        } else {
          throw new Error(json.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Error sending to Telegram:', err);
        alert('❌ Failed to send to Telegram: ' + err.message);
      }
    },
    []
  );

  const sendAllToTelegram = useCallback(async () => {
    try {
      const res = await fetch('/api/sendTelegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles }),
      });
      const json = await res.json();
      if (json.ok) {
        setArticles([]);
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error sending all to Telegram:', err);
      alert('❌ Failed to send all to Telegram: ' + err.message);
    }
  }, [articles]);

  const removeArticle = (idx) => {
    if (reviewMode) {
      const newDrafts = [...draftArticles];
      newDrafts.splice(idx, 1);
      setDraftArticles(newDrafts);
    } else {
      const newArticles = [...articles];
      newArticles.splice(idx, 1);
      setArticles(newArticles);
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === draftArticles.length) {
      setSelected([]);
    } else {
      setSelected(new Array(draftArticles.length).fill(true));
    }
  };

  const list = reviewMode ? draftArticles : articles;

  return (
    <div className="app-container">
      <h1 className="app-title">🧠 Decentralized AI News Bot</h1>

      <div className="article-grid">
        {list.map((art, idx) => {
          const publishedDate = art.publishedAt
            ? new Date(art.publishedAt)
            : null;
          const isDateValid = publishedDate && !isNaN(publishedDate.getTime());

          return (
            <motion.div key={idx} layout className="article-card">
              <div className="article-header">
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="article-title-link"
                >
                  {art.title}
                </a>
                {reviewMode && (
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
              </div>
              <p className="article-meta">
                {art.source || "Unknown Source"} •{' '}
                {isDateValid
                  ? publishedDate.toLocaleDateString() +
                    ' ' +
                    publishedDate.toLocaleTimeString()
                  : 'Date Unknown'}
                {art.incompleteData && (
                  <span
                    style={{ color: 'orange', marginLeft: 10 }}
                    title="Some article info missing or invalid"
                  >
                    ⚠️
                  </span>
                )}
              </p>
              <p className="article-desc">
                {reviewMode
                  ? art.desc.slice(0, 150) + '...'
                  : art.summary || art.desc}
              </p>
              {!reviewMode && (
                <button
                  className="btn green"
                  onClick={() => sendSingleToTelegram(art)}
                >
                  📤 Send to Telegram
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {reviewMode ? (
        <div className="bottom-area">
          <button className="btn gray" onClick={toggleSelectAll}>
            {selected.length === draftArticles.length ? 'Deselect All' : 'Select All'}
          </button>
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="url-input"
            placeholder="Paste article URL here"
          />
          <button onClick={addByUrl} className="btn green">
            ➕ Add Article
          </button>
          <button onClick={generateSummaries} className="btn blue" disabled={loading}>
            {loading ? '⏳ Summarizing...' : '⚡ Generate Summaries'}
          </button>
        </div>
      ) : (
        <div className="bottom-area">
          {loading && articles.length > 0 && (
            <button
              onClick={sendAllToTelegram}
              className="btn orange"
              style={{ marginLeft: 10 }}
            >
              📤 Send All to Telegram
            </button>
          )}
        </div>
      )}

      <button
        className="btn toggle-mode"
        onClick={() => setReviewMode(!reviewMode)}
        style={{ marginTop: 20 }}
      >
        {reviewMode ? 'Exit Review Mode' : 'Enter Review Mode'}
      </button>
    </div>
  );
}
