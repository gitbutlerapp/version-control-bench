import type { MetadataRoute } from 'next';
import rawData from '../data/results.json';

export const dynamic = 'force-static';

// Single-page site: the sitemap marks the canonical URL and when the
// data behind it last changed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://vcbench.dev/',
      lastModified: new Date(rawData.meta.snapshot_date),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
