import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/router';

export default function Success() {
  const router = useRouter();
  const { isLoaded, user } = useUser();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    setReady(true);
  }, [isLoaded]);

  const isPro = user?.publicMetadata?.plan === 'pro';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.icon}>🎉</div>
        <h1 style={styles.title}>支付成功</h1>
        <p style={styles.desc}>
          {ready
            ? isPro
              ? '你已成功升级为会员，现在可以无限次生成文案。'
              : '订单处理中，请稍等片刻后刷新页面。'
            : '正在确认会员状态...'}
        </p>
        <button style={styles.button} onClick={() => router.push('/')}>
          开始创作
        </button>
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
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    background: '#fff',
    borderRadius: '24px',
    padding: '48px 40px',
    boxShadow: '0 20px 60px rgba(255, 36, 66, 0.1)',
    textAlign: 'center',
  },
  icon: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#FF2442',
    marginBottom: '12px',
  },
  desc: {
    fontSize: '16px',
    color: '#666',
    lineHeight: 1.6,
    marginBottom: '32px',
  },
  button: {
    width: '100%',
    padding: '16px',
    borderRadius: '14px',
    background: '#FF2442',
    color: '#fff',
    fontSize: '18px',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  },
};
