import type { APIRoute } from 'astro';
import { seriesList, works, entities } from '../lib/data.js';

/**
 * 站点地图：按当前数据自动枚举全部页面（首页 / 系列 / 作品 / 词条 / 系列专属子页）。
 * 新增系列或作品时无需改动本文件。地址前缀取自 astro.config.mjs 的 site。
 */
export const GET: APIRoute = ({ site }) => {
  const base = site ? site.href.replace(/\/$/, '') : '';
  const paths = ['/', '/search/'];

  for (const s of seriesList) {
    paths.push(`/series/${s.id}/`);
    if (s.nametags && s.nametags.nametags && s.nametags.nametags.length) {
      paths.push(`/series/${s.id}/deaths/`);
    }
  }
  for (const w of works) paths.push(`/work/${w.id}/`);
  for (const e of entities) paths.push(`/entity/${e.id}/`);

  const urls = paths.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
