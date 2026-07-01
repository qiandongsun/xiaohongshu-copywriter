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
  { id: '其他', name: '其他' },
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
  const [customCategory, setCustomCategory] = useState('');
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
  const [historySearch, setHistorySearch] = useState('');
  const [historyActiveVersion, setHistoryActiveVersion] = useState<Record<string, number>>({});
  const [historyWorkingIds, setHistoryWorkingIds] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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
    const finalCategory = category === '其他' ? customCategory.trim() || '其他' : category;
    if (category === '其他' && !customCategory.trim()) {
      setError('请输入自定义赛道');
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
        body: JSON.stringify({ topic, category: finalCategory, style, contentType, versions }),
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
    const isWorking = historyWorkingIds.has(item.id);
    if (isWorking || loading) return;
    setHistoryWorkingIds((prev) => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
    setLoading(true);
    setError('');
    try {
      const finalCategory = item.category;
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: item.topic,
          category: finalCategory,
          style: item.style,
          contentType: item.contentType,
          versions: Math.min(item.versions.length || 3, 5),
        }),
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
      setCategory(categories.some((c) => c.id === item.category) ? item.category : '其他');
      setCustomCategory(categories.some((c) => c.id === item.category) ? '' : item.category);
      setStyle(item.style);
      setContentType(item.contentType as any);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (data.historyItem) {
        setCurrentHistoryItem(data.historyItem);
        setHistory((prev) => [data.historyItem, ...prev]);
      }
      setShowHistory(false);
    } catch (err: any) {
      setError(err.message || '再次生成失败');
    } finally {
      setLoading(false);
      setHistoryWorkingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const confirmDeleteHistory = (id: string) => {
    setDeleteConfirmId(id);
  };

  const cancelDeleteHistory = () => {
    setDeleteConfirmId(null);
  };

  const deleteHistoryItem = async (id: string) => {
    if (historyWorkingIds.has(id)) return;
    setHistoryWorkingIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setHistory((prev) => prev.filter((h) => h.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (err) {
      console.error('Failed to delete history:', err);
    } finally {
      setHistoryWorkingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
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

  const filteredHistory = history.filter((item) => {
    const q = historySearch.trim();
    if (!q) return true;
    return (
      item.topic.includes(q) ||
      item.category.includes(q) ||
      item.style.includes(q) ||
      item.result.includes(q) ||
      item.versions.some((v) => v.includes(q))
    );
  });

  const setHistoryVersion = (id: string, idx: number) => {
    setHistoryActiveVersion((prev) => ({ ...prev, [id]: idx }));
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
            onMouseDown={(e) => e.preventDefault()}
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
            {isLoggedIn && (
              <button
                style={styles.historyButton}
                onClick={() => setShowHistory(true)}
              >
                历史记录{history.length > 0 ? ` (${history.length})` : ''}
              </button>
            )}
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
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              {category === '其他' && (
                <input
                  style={{ ...styles.input, marginTop: '12px' }}
                  placeholder="请输入自定义赛道，例如：数码、旅行、健身"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
              )}
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
                    onMouseDown={(e) => e.preventDefault()}
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
                    onMouseDown={(e) => e.preventDefault()}
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
                    onMouseDown={(e) => e.preventDefault()}
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
                {loading ? 'AI 正在创作中，请稍候...' : isPro ? '生成文案' : `生成文案（剩余 ${remaining} 次）`}
              </button>
            )}

            {loading && (
              <div style={styles.modalOverlay}>
                <div style={styles.modalCard}>
                  <div style={styles.loadingSpinner} />
                  <p style={styles.loadingText}>正在构思小红书文案 ✍️</p>
                  <p style={styles.loadingSub}>根据主题、赛道和风格生成多个版本</p>
                  <p style={styles.loadingSub}>大约需要 5-15 秒，请稍候...</p>
                </div>
              </div>
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

            {showHistory && (
              <div style={styles.drawerOverlay} onClick={() => setShowHistory(false)}>
                <div style={styles.drawer} onClick={(e) => e.stopPropagation()}>
                  <div style={styles.drawerHeader}>
                    <h3 style={styles.drawerTitle}>历史记录</h3>
                    <button style={styles.drawerClose} onClick={() => setShowHistory(false)}>
                      ✕
                    </button>
                  </div>
                  <div style={styles.drawerContent}>
                    <div style={styles.historySearchBox}>
                      <input
                        style={styles.historySearchInput}
                        placeholder="搜索主题、赛道、风格或内容..."
                        value={historySearch}
                        onChange={(e) => setHistorySearch(e.target.value)}
                      />
                    </div>
                    {historyLoading ? (
                      <p style={styles.historyEmpty}>加载中...</p>
                    ) : filteredHistory.length === 0 ? (
                      <p style={styles.historyEmpty}>
                        {historySearch ? '没有找到匹配的记录' : '暂无生成记录'}
                      </p>
                    ) : (
                      filteredHistory.map((item) => {
                        const hasVersions = item.versions && item.versions.length > 1;
                        const activeIdx = historyActiveVersion[item.id] || 0;
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

                            {hasVersions && (
                              <div style={styles.historyVersionTabs}>
                                {item.versions.map((_, idx) => (
                                  <button
                                    key={idx}
                                    style={{
                                      ...styles.historyVersionTab,
                                      ...(activeIdx === idx ? styles.historyVersionTabActive : {}),
                                    }}
                                    onClick={() => setHistoryVersion(item.id, idx)}
                                    onMouseDown={(e) => e.preventDefault()}
                                  >
                                    版本 {idx + 1}
                                  </button>
                                ))}
                              </div>
                            )}

                            <pre style={styles.historyContent}>
                              {item.versions[activeIdx] || item.result}
                            </pre>

                            <div style={styles.historyActions}>
                              <button
                                style={{
                                  ...styles.historyActionButton,
                                  ...(historyWorkingIds.has(item.id) ? styles.historyActionButtonDisabled : {}),
                                }}
                                onClick={() =>
                                  handleCopy(
                                    item.versions[activeIdx] || item.result,
                                    `history-${item.id}-${activeIdx}`
                                  )
                                }
                                disabled={historyWorkingIds.has(item.id)}
                              >
                                {copiedMap[`history-${item.id}-${activeIdx}`] ? '已复制' : '复制'}
                              </button>
                              <button
                                style={{
                                  ...styles.historyActionButton,
                                  ...(historyWorkingIds.has(item.id) || loading ? styles.historyActionButtonDisabled : {}),
                                }}
                                onClick={() => regenerateFromHistory(item)}
                                disabled={historyWorkingIds.has(item.id) || loading}
                              >
                                {historyWorkingIds.has(item.id) ? '生成中...' : '再次生成'}
                              </button>
                              <button
                                style={{
                                  ...styles.historyActionButton,
                                  ...(historyWorkingIds.has(item.id) ? styles.historyActionButtonDisabled : {}),
                                }}
                                onClick={() => confirmDeleteHistory(item.id)}
                                disabled={historyWorkingIds.has(item.id)}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {deleteConfirmId && (
              <div style={styles.modalOverlay}>
                <div style={styles.confirmCard}>
                  <h3 style={styles.confirmTitle}>确认删除？</h3>
                  <p style={styles.confirmText}>删除后无法恢复，是否继续？</p>
                  <div style={styles.confirmActions}>
                    <button
                      style={{ ...styles.confirmButton, ...styles.confirmButtonSecondary }}
                      onClick={cancelDeleteHistory}
                    >
                      取消
                    </button>
                    <button
                      style={{ ...styles.confirmButton, ...styles.confirmButtonDanger }}
                      onClick={() => deleteHistoryItem(deleteConfirmId)}
                      disabled={historyWorkingIds.has(deleteConfirmId)}
                    >
                      {historyWorkingIds.has(deleteConfirmId) ? '删除中...' : '确认删除'}
                    </button>
                  </div>
                </div>
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
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
  },
  activeButton: {
    background: '#FF2442',
    color: '#fff',
    borderColor: '#FF2442',
    outline: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    appearance: 'none',
  },
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
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
  },
  modalCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#fff',
    borderRadius: '20px',
    padding: '48px 36px',
    maxWidth: '360px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  loadingSpinner: {
    width: '44px',
    height: '44px',
    border: '4px solid #ffe4e8',
    borderTop: '4px solid #FF2442',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '20px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#FF2442',
  },
  loadingSub: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#999',
    textAlign: 'center',
    lineHeight: '1.6',
  },
  confirmCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '28px',
    maxWidth: '360px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
  },
  confirmTitle: {
    margin: '0 0 12px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
  },
  confirmText: {
    margin: '0 0 24px',
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.6',
  },
  confirmActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
  },
  confirmButton: {
    padding: '10px 20px',
    borderRadius: '10px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  confirmButtonSecondary: {
    background: '#f5f5f5',
    color: '#666',
  },
  confirmButtonDanger: {
    background: '#FF2442',
    color: '#fff',
  },
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
  historyButton: {
    padding: '8px 16px',
    borderRadius: '20px',
    border: '1px solid #FF2442',
    background: '#fff',
    color: '#FF2442',
    fontSize: '14px',
    cursor: 'pointer',
    marginRight: '12px',
    fontWeight: 600,
  },
  drawerOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    width: '100%',
    maxWidth: '480px',
    height: '100vh',
    background: '#fff',
    boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.1)',
    display: 'flex',
    flexDirection: 'column',
  },
  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #f0f0f0',
  },
  drawerTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
  },
  drawerClose: {
    padding: '6px 12px',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    color: '#666',
    fontSize: '16px',
    cursor: 'pointer',
  },
  drawerContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px 24px',
  },
  historyEmpty: {
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
    padding: '20px',
  },
  historyItem: {
    background: '#fff8f9',
    borderRadius: '12px',
    padding: '14px',
    marginBottom: '12px',
    border: '1px solid #ffe4e8',
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
  historySearchBox: {
    marginBottom: '16px',
  },
  historySearchInput: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: '2px solid #ffe4e8',
    fontSize: '14px',
    outline: 'none',
  },
  historyVersionTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '10px',
    flexWrap: 'wrap',
  },
  historyVersionTab: {
    padding: '5px 12px',
    borderRadius: '14px',
    border: '1px solid #e0e0e0',
    background: '#fff',
    color: '#666',
    fontSize: '12px',
    cursor: 'pointer',
  },
  historyVersionTabActive: {
    background: '#FF2442',
    color: '#fff',
    borderColor: '#FF2442',
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
  historyActionButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
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
