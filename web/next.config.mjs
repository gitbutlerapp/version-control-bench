import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // pin the tracing root to this app dir (a stray lockfile in $HOME otherwise
  // confuses Next's monorepo root inference)
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
