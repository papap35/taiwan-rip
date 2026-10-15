import type { MetadataRoute } from 'next';
import { COUNTIES } from '@/lib/counties.ts';
import { siteUrl } from '@/lib/site.ts';
import { loadTemples } from '@/lib/server/dataset.ts';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const url = (path: string) => new URL(path, base).toString();
  const temples = await loadTemples();
  return [
    { url: url('/'), changeFrequency: 'daily', priority: 1 },
    { url: url('/county'), changeFrequency: 'daily', priority: 0.8 },
    ...COUNTIES.map((c) => ({ url: url(`/county/${c.slug}`), changeFrequency: 'daily' as const, priority: 0.7 })),
    { url: url('/temples'), changeFrequency: 'weekly', priority: 0.6 },
    ...temples.map((t) => ({ url: url(`/temples/${t.id}`), changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...['/about/method', '/about/data', '/about/disclaimer'].map((p) => ({ url: url(p), changeFrequency: 'monthly' as const, priority: 0.3 })),
  ];
}
