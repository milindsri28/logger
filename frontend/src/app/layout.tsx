import type { Metadata } from 'next';
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { OAuthTokenHandlerRoot } from '@/components/setup/OAuthTokenHandlerRoot';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'LogsSucks.cloud — Find Root Causes',
  description: 'Stop drowning in logs. Connect evidence across your stack and see what actually broke.',
  icons: {
    icon: '/favicon.svg',
    apple: '/logo-icon.svg',
  },
  openGraph: {
    title: 'LogsSucks.cloud',
    description: 'Find root causes instead of reading logs.',
    siteName: 'LogsSucks.cloud',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark h-full ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="h-full overflow-hidden">
        <QueryProvider>
          <OAuthTokenHandlerRoot />
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
