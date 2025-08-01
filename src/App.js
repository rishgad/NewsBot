import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import './App.css';

export default function App() {
  const [draftArticles, setDraftArticles] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('draftArticles');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(true);
  const [newUrl, setNewUrl] = useState('');
  const [editedTitle, setEditedTitle] = useState('');
  const [sentArticles, setSentArticles] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sentArticles');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [articles, setArticles] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedArticles = localStorage.getItem('articles');
      const savedSent = localStorage.getItem('sentArticles');
      const sent = savedSent ? JSON.parse(savedSent) : [];
      if (!savedArticles) return [];
      const parsedArticles = JSON.parse(savedArticles);
      const sentUrls = new Set(sent.map((a) => a.url));
      return parsedArticles.filter((a) => !sentUrls.has(a.url));
    }
    return [];
  });
  const [selected, setSelected] = useState(() => {
    const saved = localStorage.getItem('selected');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [editingIdx, setEditingIdx] = useState(null);
  const [editedSummary, setEditedSummary] = useState('');

  useEffect(() => {
    const savedArticles = localStorage.getItem('articles');
    const savedSent = localStorage.getItem('sentArticles');
  
    if (savedArticles && savedSent) {
      const articles = JSON.parse(savedArticles);
      const sent = JSON.parse(savedSent);
      const sentUrls = new Set(sent.map((a) => a.url));
  
      const filtered = articles.filter((a) => !sentUrls.has(a.url));
      setArticles(filtered);
    }
  }, []);
  
  useEffect(() => {
    localStorage.setItem('sentArticles', JSON.stringify(sentArticles));
  }, [sentArticles]);

  useEffect(() => {
    localStorage.setItem('draftArticles', JSON.stringify(draftArticles));
  }, [draftArticles]);

  useEffect(() => {
    localStorage.setItem('articles', JSON.stringify(articles));
  }, [articles]);

  useEffect(() => {
    localStorage.setItem('selected', JSON.stringify(selected));
  }, [selected]);

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
        const initialDrafts = news.articles.map((art) => ({
          title: art.title,
          desc: art.description || art.content || art.title || '',
          url: art.url,
          source: art.source?.name || art.source || 'Unknown Source',
          publishedAt: art.publishedAt || '',
        }));
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
      setDraftArticles((prev) => [
        ...prev,
        {
          title: json.title,
          desc: json.desc,
          url: newUrl.trim(),
          source: json.source || 'Unknown Source',
          publishedAt: json.publishedAt || '',
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
      if (selectedArticles.length === 0) {
        alert('Please select at least one article to summarize.');
        setLoading(false);
        return;
      }

      const newlySummarized = await Promise.all(
        selectedArticles.map(async (art) => {
          // If already summarized, just return it
          if (art.summary) return art;

          const sumRes = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: art.desc }),
          });

          const { summary } = await sumRes.json();
          return { ...art, summary };
        })
      );

      // Always update full selected set (to show all), preserving edits
      const updatedArticles = selectedArticles.map((art) => {
        const existing = articles.find((a) => a.url === art.url);
        return existing || newlySummarized.find((a) => a.url === art.url) || art;
      });

      setArticles(updatedArticles);
      setReviewMode(false);
    } catch (err) {
      console.error('Error generating summaries:', err);
    } finally {
      setLoading(false);
    }
  }, [draftArticles, selected, articles]);


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
          setSentArticles((prev) => [article, ...prev]);
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

  // Update selection with URLs:
  const toggleSelect = (url) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(url)) newSet.delete(url);
      else newSet.add(url);
      return newSet;
    });
  };

  const sendAllToTelegram = useCallback(async () => {
    if (articles.length === 0) {
      alert('No summarized articles to send.');
      return;
    }
    if (!window.confirm('Are you sure you want to send all articles to Telegram?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/sendTelegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles }),
      });
      const json = await res.json();
      if (json.ok) {
        setSentArticles((prev) => [...prev, ...articles]);
        setArticles([]);
        alert('✅ All articles sent to Telegram!');
      } else {
        throw new Error(json.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error sending all to Telegram:', err);
      alert('❌ Failed to send all to Telegram: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [articles]);

  const removeArticle = (idx) => {
    if (reviewMode) {
      const newDrafts = [...draftArticles];
      newDrafts.splice(idx, 1);
      setDraftArticles(newDrafts);

      const newSelected = [...selected];
      newSelected.splice(idx, 1);
      setSelected(newSelected);
    } else {
      const newArticles = [...articles];
      newArticles.splice(idx, 1);
      setArticles(newArticles);
    }
  };

  const removeSentArticle = (idx) => {
    const updated = [...sentArticles];
    updated.splice(idx, 1);
    setSentArticles(updated);
  };

  const toggleSelectAll = () => {
    if (!draftArticles.length) return;
    const allSelected = selected.length === draftArticles.length && selected.every(Boolean);
    if (allSelected) {
      setSelected(new Array(draftArticles.length).fill(false));
    } else {
      setSelected(new Array(draftArticles.length).fill(true));
    }
  };

  const list = reviewMode ? draftArticles : articles;

  return (
    <div className="app-container">
      <h1 className="app-title">Distrobot - Decentralized AI News</h1>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button onClick={fetchInitialArticles} className="btn gray" disabled={loading}>
          Refresh
        </button>
      </div>
      <div className="article-grid">
        {list.map((art, idx) => (
          <motion.div key={idx} layout className="article-card">
            <div className="article-header">
              {editingIdx === idx ? (
                <input
                  className="title-editor"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  style={{ width: '100%', fontWeight: 'bold', fontSize: '16px' }}
                />
              ) : (
                <a href={art.url} target="_blank" rel="noopener noreferrer" className="article-title-link">
                  {art.title}
                </a>
              )}
              {reviewMode && (
                <button
                  onClick={() => {
                    const updated = [...selected];
                    updated[idx] = !updated[idx];
                    setSelected(updated);
                  }}
                  title="Select article"
                  className={`btn small ${selected[idx] ? 'selected' : ''}`}
                >
                  {selected[idx] ? '✓ Selected' : 'Select'}
                </button>
              )}
            </div>
            <p className="article-meta">
              {art.source} • {art.publishedAt ? art.publishedAt : ''}{' '}
            </p>
            <p className="article-desc">
              {reviewMode ? art.desc.slice(0, 150) + '...' : editingIdx === idx ? (
                <textarea
                  className="summary-editor"
                  value={editedSummary}
                  onChange={(e) => setEditedSummary(e.target.value)}
                  style={{ width: '100%', minHeight: '60px' }}
                />
              ) : (
                art.summary
              )}
            </p>
            {!reviewMode && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {editingIdx === idx ? (
                  <>
                    <button
                      className="btn green"
                      onClick={() => {
                        const updatedArticles = articles.map((a, i) =>
                          i === idx ? { ...a, summary: editedSummary, title: editedTitle } : a
                        );
                        setArticles(updatedArticles);
                        setEditingIdx(null);
                        setEditedSummary('');
                      }}
                    >
                      Save
                    </button>
                    <button
                      className="btn gray"
                      onClick={() => {
                        setEditingIdx(null);
                        setEditedSummary('');
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn green"
                      onClick={() => {
                        if (window.confirm('Send this article to Telegram?')) {
                          sendSingleToTelegram(art);
                        }
                      }}
                    >
                      Send to Telegram
                    </button>
                    <button
                      className="btn blue"
                      onClick={() => {
                        setEditingIdx(idx);
                        setEditedSummary(art.summary);
                        setEditedTitle(art.title);
                      }}
                    >
                      Edit Summary
                    </button>
                    <button className="btn gray" onClick={() => removeArticle(idx)}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        ))}

        {!reviewMode && sentArticles.length > 0 && (
          <div className="sent-section">
            <h2>Already Sent</h2>
            {sentArticles.map((art, idx) => (
              <div key={idx} className="article-card sent">
                <a href={art.url} target="_blank" rel="noopener noreferrer" className="article-title-link">
                  {art.title}
                </a>
                <p className="article-meta">
                  {art.source} • {art.publishedAt ? art.publishedAt : ''}
                </p>
                <p className="article-desc">{art.summary}</p>
                <button className="btn gray" onClick={() => removeSentArticle(idx)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {reviewMode ? (
        <div className="bottom-area" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="text"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="url-input"
              placeholder="Paste article URL here"
            />
            <button onClick={addByUrl} className="btn green" disabled={loading}>
              Add Article
            </button>
            <button onClick={generateSummaries} className="btn blue" disabled={loading}>
              {loading ? '⏳ Summarizing...' : 'Generate Summaries'}
            </button>
          </div>

          {reviewMode && draftArticles.length > 0 && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={toggleSelectAll} className="btn gray">
                Select All
              </button>
              <button
                onClick={() => setSelected(new Array(draftArticles.length).fill(false))}
                className="btn gray"
              >
                Unselect All
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="footer">
          <button
            onClick={() => {
              // Store summaries and edits before going back
              const updatedDrafts = draftArticles.map((draft) => {
                const match = articles.find((a) => a.url === draft.url);
                return match
                  ? { ...draft, summary: match.summary, title: match.title }
                  : draft;
              });
              setDraftArticles(updatedDrafts);
              setReviewMode(true);
            }}
            className="btn gray"
          >
            Back
          </button>
          <button onClick={sendAllToTelegram} className="btn orange" style={{ marginLeft: 10 }}>
            Send All to Telegram
          </button>
        </div>
      )}
    </div>
  );
}