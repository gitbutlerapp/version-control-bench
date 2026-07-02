import Script from 'next/script';

// Umami is self-hosted at u.gitbutler.com. `data-domains` scopes it to the
// production host, so local dev and Vercel preview URLs never send events.
// Loaded afterInteractive so it never blocks first paint.
export function Umami() {
  return (
    <Script
      src="https://u.gitbutler.com/script.js"
      data-website-id="d5b61410-aeca-4b73-8c40-3e45f2d141b1"
      data-domains="vcbench.dev"
      strategy="afterInteractive"
    />
  );
}
