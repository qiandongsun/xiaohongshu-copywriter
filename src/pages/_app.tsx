import '@/styles/globals.css';
import type { AppProps, AppContext } from 'next/app';
import NextApp from 'next/app';
import { ClerkProvider } from '@clerk/nextjs';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider afterSignOutUrl="/" {...pageProps}>
      <Component {...pageProps} />
    </ClerkProvider>
  );
}

// 禁用静态生成，避免 Clerk 在 SSR 阶段误选 app-router provider
App.getInitialProps = async (appContext: AppContext) => {
  const appProps = await NextApp.getInitialProps(appContext);
  return { ...appProps };
};
