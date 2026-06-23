import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/components/providers/QueryProvider';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'AI Debug Investigator',
  description: 'AI-powered incident investigation for engineering teams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark h-full ${inter.variable}`}>
      <body className="h-full overflow-hidden">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
