import { useState, useEffect } from 'react';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';
import { formatRemaining } from '@/lib/quota-shared';
import type { HistoryItem } from '@/lib/history';

const categories = [
  { id: '美妆', name: '美妆' },
  { id: '家居', name: '家居' },
  { id: '职场', name: '职场' },
  { id: '穿搭', name: '穿搭' },
  { id: '美食', name: '美食' },
  { id: '育儿', name: '育儿' },
  { id: '情感', name: '情感' },
];

const styleOptions = [
  { id: '干货型', name: '干货型' },
  { id: '种草型', name: '种草型' },
  { id: '吐槽型', name: '吐槽型' },
  { id: '故事型', name: '故事型' },
];

const contentTypes = [
  { id: 'title', name: '标题' },
  { id: 'content', name: '正文' },
  { id: 'both', name: '标题+正文' },
];

const versionOptions = [
  { id: 1, name: '1 个' },
  { id: 3, name: '3 个' },
  { id: 5, name: '5 个' },
];

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export default function Home() {
  const { isLoaded, userId } = useAuth();
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('美妆');
  const [style, setStyle] = useState('干货型');
  const [contentType, setContentType] = useState('both');
  const [versions, setVersions] = useState(3);
  const [result, setResult] = useState('');
  const [resultVersions, setResultVersions] = useState<string[]>([]);
  const [activeVersion, setActiveVersion] = useState(0);
  const [currentHistoryItem, setCurrentHistoryItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});
  const [remaining, setRemaining] = useState(3);
  const [isPro, setIsPro] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  useEffect(() => {
    if (!isLoaded) return;
    setCheckingAuth(false);
    if (!userId) return;

    fetch('/api/quota')
      .then((res) => res.json())
      .then((data) => {
        if (typeof data.remaining === 'number') {
          setRemaining(data.remaining);
        }
        setIsPro(data.isPro || false);
      })
      .catch((err) => {
        console.error('Failed to fetch quota:', err);
      });

    loadHistory();
  }, [isLoaded, userId]);

  useEffect(() => {
    // 标题默认 5 个变体，其他默认 3 个
    setVersions(contentType === 'title' ? 5 : 3);
    setActiveVersion(0);
  }, [contentType]);

  const loadHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      if (res.ok && Array.isArray(data.history)) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请输入主题');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');
    setResultVersions([]);
    setActiveVersion(0);
    setCurrentHistoryItem(null);
    setIsEditing(false);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, category, style, contentType, versions }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setShowUpgrade(true);
        }
        throw new Error(data.detail || data.error || '生成失败');
      }

      const versionsList = Array.isArray(data.versions) ? data.versions : [data.result];
      setResult(data.result || versionsList[0] || '');
      setResultVersions(versionsList);
      setActiveVersion(0);
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining);
      }
      if (data.historyItem) {
        setCurrentHistoryItem(data.historyItem);
        setHistory((prev) => [data.historyItem, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || '生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMap((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedMap((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '创建支付失败');
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('未返回支付链接');
      }
    } catch (err: any) {
      setError(err.message || '跳转支付失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (item: HistoryItem) => {
    try {
      const res = await fetch('/api/history', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, favorite: !item.favorite }),
      });
      const data = await res.json();
      if (res.ok && data.historyItem) {
        setHistory((prev) =>
          prev.map((h) => (h.id === item.id ? data.historyItem : h))
        );
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const regenerateFromHistory = async (item: HistoryItem) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/history/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) setShowUpgrade(true);
        throw new Error(data.detail || data.error || '再次生成失败');
      }
      const versionsList = Array.isArray(data.versions) ? data.versions : [data.result];
      setResult(data.result || versionsList[0] || '');
      setResultVersions(versionsList);
      setActiveVersion(0);
      setTopic(item.topic);
      setCategory(item.category);
      setStyle(item.style);
      setContentType(item.contentType as any);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (data.historyItem) {
        setCurrentHistoryItem(data.historyItem);
        setHistory((prev) => [data.historyItem, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || '再次生成失败');
    } finally {
      setLoading(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete history:', err);
    }
  };

  const startEdit = () => {
    setEditedText(resultVersions[activeVersion] || result);
    setIsEditing(true);
  };

  const saveEdit = async () => {
    const newVersions = [...resultVersions];
    newVersions[activeVersion] = editedText;
    setResultVersions(newVersions);
    if (activeVersion === 0) setResult(editedText);
    setIsEditing(false);

    if (currentHistoryItem) {
      try {
        await fetch('/api/history', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentHistoryItem.id, result: editedText }),
        });
        loadHistory();
      } catch (err) {
        console.error('Failed to save edit:', err);
      }
    }
  };

  const toggleExpandHistory = (id: string) => {
    setExpandedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isLoggedIn = !!userId;
  const canGenerate = isLoggedIn && (isPro || remaining > 0);

  const renderVersionTabs = () => {
    if (resultVersions.length <= 1) return null;
    return (
      <div style={styles.versionTabs}>
        {resultVersions.map((_, idx) => (
          <button
            key={idx}
            style={{
              ...styles.versionTab,
              ...(activeVersion === idx ? styles.versionTabActive : {}),
            }}
            onClick={() => {
              setActiveVersion(idx);
              setIsEditing(false);
            }}
          >
            版本 {idx + 1}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div />
          <div style={styles.authControls}>
            {checkingAuth ? (
              <span style={styles.authHint}>加载中...</span>
            ) : isLoggedIn ? (
              <UserButton />
            ) : (
              <SignInButton mode="modal">
                <button style={styles.signInButton}>登录</button>
              </SignInButton>
            )}
          </div>
        </div>

        <h1 style={styles.title}>小红书爆款文案生成器</h1>
        <p style={styles.subtitle}>输入关键词，10 秒生成爆款标题和正文</p>

        {!isLoggedIn ? (
          <div style={styles.guestSection}>
            <p style={styles.guestTitle}>登录后即可免费生成</p>
            <p style={styles.guestDesc}>新用户每日可享 3 次免费生成额度</p>
            <SignInButton mode="modal">
              <button style={styles.generateButton}>立即登录</button>
            </SignInButton>
          </div>
        ) : (
          <>
            <div style={styles.quotaBar}>
              <span style={styles.quotaLabel}>{isPro ? '会员版' : '免费版'}</span>
              <span style={styles.quotaValue}>{formatRemaining(remaining)}</span>
            </div>

            <div style={styles.section}>
              <label style={styles.label}>笔记主题</label>
              <input
                style={styles.input}
                placeholder="例如：早八通勤穿搭"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>

            <div style={styles.section}>
              <label style={styles.label}>选择赛道</label>
              <div style={styles.buttonGroup}>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    style={{
                      ...styles.optionButton,
                      ...(category === c.id ? styles.activeButton : {}),
                    }}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <label style={styles.label}>内容类型</label>
              <div style={styles.buttonGroup}>
                {contentTypes.map((t) => (
                  <button
                    key={t.id}
                    style={{
                      ...styles.optionButton,
                      ...(contentType === t.id ? styles.activeButton : {}),
                    }}
                    onClick={() => setContentType(t.id as any)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <label style={styles.label}>生成数量</label>
              <div style={styles.buttonGroup}>
                {versionOptions.map((v) => (
                  <button
                    key={v.id}
                    style={{
                      ...styles.optionButton,
                      ...(versions === v.id ? styles.activeButton : {}),
                    }}
                    onClick={() => setVersions(v.id)}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.section}>
              <label style={styles.label}>文案风格</label>
              <div style={styles.buttonGroup}>
                {styleOptions.map((s) => (
                  <button
                    key={s.id}
                    style={{
                      ...styles.optionButton,
                      ...(style === s.id ? styles.activeButton : {}),
                    }}
                    onClick={() => setStyle(s.id)}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={styles.error}>{error}</p>}

            {showUpgrade && !isPro && (
              <div style={styles.upgradeBanner}>
                <p>今日免费额度已用完 🎉</p>
                <p style={styles.upgradeSub}>升级会员，畅享无限次生成</p>
                <button
                  style={styles.generateButton}
                  onClick={handleUpgrade}
                  disabled={loading}
                >
                  {loading ? '处理中...' : '升级会员'}
                </button>
              </div>
            )}

            {!showUpgrade && (
              <button
                style={{
                  ...styles.generateButton,
                  ...(!canGenerate || loading ? styles.loadingButton : {}),
                }}
                onClick={handleGenerate}
                disabled={!canGenerate || loading}
              >
                {loading ? '生成中...' : isPro ? '生成文案' : `生成文案（剩余 ${remaining} 次）`}
              </button>
            )}

            {resultVersions.length > 0 && (
              <div style={styles.resultSection}>
                <div style={styles.resultHeader}>
                  <span style={styles.resultTitle}>生成结果</span>
                  <div style={styles.resultActions}>
                    {isEditing ? (
                      <>
                        <button
                          style={{ ...styles.copyButton, marginRight: 8 }}
                          onClick={() => setIsEditing(false)}
                        >
                          取消
                        </button>
                        <button style={styles.copyButton} onClick={saveEdit}>保存</button>
                      </>
                    ) : (
                      <>
                        <button
                          style={{ ...styles.copyButton, marginRight: 8 }}
                          onClick={startEdit}
                        >
                          编辑
                        </button>
                        <button
                          style={styles.copyButton}
                          onClick={() =>
                            handleCopy(
                              resultVersions[activeVersion] || result,
                              `version-${activeVersion}`
                            )
                          }
                        >
                          {copiedMap[`version-${activeVersion}`] ? '已复制' : '复制全部'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {renderVersionTabs()}

                {isEditing ? (
                  <textarea
                    style={{ ...styles.input, minHeight: 200, marginTop: 12 }}
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                  />
                ) : (
                  <pre style={styles.resultContent}>
                    {resultVersions[activeVersion] || result}
                  </pre>
                )}
              </div>
            )}

            <div style={styles.historyToggle}>
              <button
                style={styles.historyToggleButton}
                onClick={() => setShowHistory((s) => !s)}
              >
                {showHistory ? '收起历史记录' : `展开历史记录 (${history.length})`}
              </button>
            </div>

            {showHistory && (
              <div style={styles.historySection}>
                {historyLoading ? (
                  <p style={styles.historyEmpty}>加载中...</p>
                ) : history.length === 0 ? (
                  <p style={styles.historyEmpty}>暂无生成记录</p>
                ) : (
                  history.map((item) => {
                    const isExpanded = expandedHistoryIds.has(item.id);
                    const hasVersions = item.versions && item.versions.length > 1;
                    return (
                      <div key={item.id} style={styles.historyItem}>
                        <div style={styles.historyItemHeader}>
                          <div>
                            <span style={styles.historyTopic}>{truncate(item.topic, 20)}</span>
                            <span style={styles.historyMeta}>
                              {' '}
                              · {item.category} · {item.style} · {formatTime(item.createdAt)}
                              {hasVersions && (
                                <span style={styles.historyVersionCount}> · {item.versions.length} 个版本</span>
                              )}
                            </span>
                          </div>
                          <button
                            style={{
                              ...styles.favoriteButton,
                              ...(item.favorite ? styles.favoriteActive : {}),
                            }}
                            onClick={() => toggleFavorite(item)}
                          >
                            {item.favorite ? '★' : '☆'}
                          </button>
                        </div>

                        {!isExpanded && (
                          <pre style={styles.historyContent}>{truncate(item.result, 120)}</pre>
                        )}

                        {isExpanded && hasVersions && (
                          <div style={styles.historyVersions}>
                            {item.versions.map((version, idx) => (
                              <div key={idx} style={styles.historyVersionItem}>
                                <div style={styles.historyVersionHeader}>
                                  <span style={styles.historyVersionTitle}>版本 {idx + 1}</span>
                                  <button
                                    style={styles.historyActionButton}
                                    onClick={() => handleCopy(version, `history-${item.id}-${idx}`)}
                                  >
                                    {copiedMap[`history-${item.id}-${idx}`] ? '已复制' : '复制'}
                                  </button>
                                </div>
                                <pre style={styles.historyVersionContent}>{version}</pre>
                              </div>
                            ))}
                          </div>
                        )}

                        <div style={styles.historyActions}>
                          {hasVersions && (
                            <button
                              style={styles.historyActionButton}
                              onClick={() => toggleExpandHistory(item.id)}
                            >
                              {isExpanded ? '收起版本' : '查看版本'}
                            </button>
                          )}
                          <button
                            style={styles.historyActionButton}
                            onClick={() => handleCopy(item.result, `history-${item.id}`)}
                          >
                            {copiedMap[`history-${item.id}`] ? '已复制' : '复制首条'}
                          </button>
                          <button
                            style={styles.historyActionButton}
                            onClick={() => regenerateFromHistory(item)}
                            disabled={loading}
                          >
                            再次生成
                          </button>
                          <button
                            style={styles.historyActionButton}
                            onClick={() => deleteHistoryItem(item.id)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div style={styles.footer}>
              <p>{isPro ? '会员无限生成' : `免费版 ${formatRemaining(remaining)}`}</p>
              {!isPro && (
                <button style={styles.upgradeButton} onClick={handleUpgrade}>
                  升级会员
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #fff0f3 0%, #fff 50%, #fff0f3 100%)',
    padding: '40px 20px',
    display: 'flex',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '720px',
    background: '#fff',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 20px 60px rgba(255, 36, 66, 0.1)',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#FF2442',
    textAlign: 'center',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '32px',
  },
  section: { marginBottom: '24px' },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '10px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '2px solid #ffe4e8',
    fontSize: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  buttonGroup: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
  optionButton: {
    padding: '10px 18px',
    borderRadius: '20px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    color: '#666',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  activeButton: { background: '#FF2442', color: '#fff', borderColor: '#FF2442' },
  generateButton: {
    width: '100%',
    padding: '16px',
    borderRadius: '14px',
    background: '#FF2442',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
    marginTop: '10px',
    marginBottom: '24px',
  },
  loadingButton: { opacity: 0.7, cursor: 'not-allowed' },
  error: { color: '#FF2442', marginBottom: '16px', fontSize: '14px' },
  resultSection: {
    background: '#fff8f9',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  resultTitle: { fontWeight: 'bold', color: '#333' },
  resultActions: { display: 'flex', alignItems: 'center' },
  copyButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    background: '#fff',
    border: '1px solid #FF2442',
    color: '#FF2442',
    cursor: 'pointer',
    fontSize: '14px',
  },
  resultContent: {
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    fontSize: '15px',
    lineHeight: '1.8',
    color: '#333',
    fontFamily: 'inherit',
  },
  versionTabs: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  versionTab: {
    padding: '6px 14px',
    borderRadius: '16px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
  },
  versionTabActive: {
    background: '#FF2442',
    color: '#fff',
    borderColor: '#FF2442',
  },
  historyToggle: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  historyToggleButton: {
    padding: '8px 20px',
    borderRadius: '20px',
    border: '1px solid #FF2442',
    background: '#fff',
    color: '#FF2442',
    fontSize: '14px',
    cursor: 'pointer',
  },
  historySection: {
    background: '#fff8f9',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '24px',
  },
  historyEmpty: {
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
    padding: '20px',
  },
  historyItem: {
    background: '#fff',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '12px',
  },
  historyItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  historyTopic: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: '14px',
  },
  historyMeta: {
    color: '#999',
    fontSize: '12px',
  },
  historyContent: {
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    fontSize: '13px',
    lineHeight: '1.6',
    color: '#666',
    fontFamily: 'inherit',
    marginBottom: '10px',
  },
  historyVersionCount: {
    color: '#FF2442',
    fontWeight: 600,
  },
  historyVersions: {
    marginTop: '12px',
    marginBottom: '12px',
  },
  historyVersionItem: {
    background: '#fff8f9',
    borderRadius: '10px',
    padding: '12px',
    marginBottom: '10px',
  },
  historyVersionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  historyVersionTitle: {
    fontWeight: 'bold',
    color: '#FF2442',
    fontSize: '13px',
  },
  historyVersionContent: {
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    fontSize: '13px',
    lineHeight: '1.7',
    color: '#333',
    fontFamily: 'inherit',
    margin: 0,
  },
  historyActions: {
    display: 'flex',
    gap: '8px',
  },
  historyActionButton: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    color: '#666',
    fontSize: '13px',
    cursor: 'pointer',
  },
  favoriteButton: {
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    color: '#999',
    fontSize: '16px',
    cursor: 'pointer',
  },
  favoriteActive: {
    color: '#FF2442',
    borderColor: '#FF2442',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '20px',
    borderTop: '1px solid #f0f0f0',
    color: '#999',
    fontSize: '14px',
  },
  upgradeButton: {
    padding: '8px 16px',
    borderRadius: '8px',
    background: '#FF2442',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  authControls: { display: 'flex', alignItems: 'center' },
  authHint: { fontSize: '14px', color: '#999' },
  signInButton: {
    padding: '8px 18px',
    borderRadius: '20px',
    background: '#FF2442',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  guestSection: { textAlign: 'center', padding: '40px 20px' },
  guestTitle: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
  },
  guestDesc: { fontSize: '14px', color: '#666', marginBottom: '24px' },
  quotaBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff8f9',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '24px',
  },
  quotaLabel: { fontSize: '14px', fontWeight: 600, color: '#FF2442' },
  quotaValue: { fontSize: '14px', color: '#666' },
  upgradeBanner: {
    background: '#fff8f9',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center',
    color: '#FF2442',
    fontWeight: 'bold',
  },
  upgradeSub: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 'normal',
    marginBottom: '16px',
  },
};
