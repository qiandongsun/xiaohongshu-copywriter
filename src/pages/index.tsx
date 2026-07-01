import { useState, useEffect } from 'react';
import { useAuth, SignInButton, UserButton } from '@clerk/nextjs';
import { formatRemaining } from '@/lib/quota-shared';

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

export default function Home() {
  const { isLoaded, userId } = useAuth();
  const [topic, setTopic] = useState('');
  const [category, setCategory] = useState('美妆');
  const [style, setStyle] = useState('干货型');
  const [contentType, setContentType] = useState('both');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [remaining, setRemaining] = useState(3);
  const [isPro, setIsPro] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);

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
  }, [isLoaded, userId]);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请输入主题');
      return;
    }
    setLoading(true);
    setError('');
    setResult('');

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, category, style, contentType }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          setShowUpgrade(true);
        }
        throw new Error(data.detail || data.error || '生成失败');
      }
      setResult(data.result);
      if (typeof data.remaining === 'number') {
        setRemaining(data.remaining);
      }
    } catch (err: any) {
      setError(err.message || '生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (result) {
      navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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

  const isLoggedIn = !!userId;
  const canGenerate = isLoggedIn && (isPro || remaining > 0);

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
                    onClick={() => setContentType(t.id)}
                  >
                    {t.name}
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

            {result && (
              <div style={styles.resultSection}>
                <div style={styles.resultHeader}>
                  <span style={styles.resultTitle}>生成结果</span>
                  <button style={styles.copyButton} onClick={handleCopy}>
                    {copied ? '已复制' : '复制全部'}
                  </button>
                </div>
                <pre style={styles.resultContent}>{result}</pre>
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
