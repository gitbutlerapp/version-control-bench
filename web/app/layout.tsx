import type { Metadata } from 'next';
import { Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Umami } from './components/Umami';

// Both are variable fonts: loading the full weight axis (one file each) lets
// the stylesheet's in-between weights (550, 650, 680, 720) render as designed
// instead of snapping to the nearest static instance.
const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-hanken',
});

const jbmono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jbmono',
});

const title = 'A version-control benchmark for coding agents';
const description =
  'Which version-control tool should you give your coding agent? Claude Code and Codex run version-control tasks with git, Jujutsu, and GitButler, graded on the resulting Git history by a deterministic checker. Maintained by GitButler, one of the three tools measured.';

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL('https://vcbench.dev'),
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

// Runs before first paint: apply the stored theme, or fall back to the OS
// preference, so there is no flash of the wrong palette on load.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${hanken.variable} ${jbmono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
      <Umami />
    </html>
  );
}
