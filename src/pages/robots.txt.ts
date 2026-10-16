import type { APIRoute } from 'astro';

/**
 * 允许全部爬虫抓取，并指向站点地图。
 * Sitemap 的地址取自 astro.config.mjs 的 site（买域名后改那一行即可）。
 */
export const GET: APIRoute = ({ site }) => {
  const base = site ? site.href.replace(/\/$/, '') : '';
  const body = `User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
