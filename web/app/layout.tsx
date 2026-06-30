import type { Metadata } from 'next';
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hanken',
  weight: ['400', '500', '600', '700', '800'],
});

const jbmono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jbmono',
  weight: ['400', '500', '600', '700'],
});

const title = 'A version-control benchmark for coding agents';
const description =
  'We measured Claude Code and Codex doing five real Git cleanup chores three ways — plain git, GitButler, and Jujutsu. Timed, graded by a hidden checker, and shown with the warts. Built by GitButler, one of the three tools measured.';

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL('https://version-control-bench.vercel.app'),
  openGraph: {
    title,
    description,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${hanken.variable} ${jbmono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
