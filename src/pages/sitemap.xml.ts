import type { APIRoute } from 'astro';
import { seriesList, works, entities, arsenalOfSeries, bestiaryOfSeries, extrasOfSeries, pathogensOfSeries } from '../lib/data.js';

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
    // 武器与能力图鉴（由收集条目派生，有该类条目的系列才有这个子页）
    if (arsenalOfSeries(s.id).length > 0) {
      paths.push(`/series/${s.id}/arsenal/`);
    }
    // 怪物与首领图鉴（同上）
    if (bestiaryOfSeries(s.id).length > 0) {
      paths.push(`/series/${s.id}/bestiary/`);
    }
    // 关卡与秘密索引（同上）
    if (extrasOfSeries(s.id).length > 0) {
      paths.push(`/series/${s.id}/extras/`);
    }
    // B.O.W. 与病原体谱系（独立数据文件，只有写了 pathogens.json 的系列才有）
    if (pathogensOfSeries(s.id)) {
      paths.push(`/series/${s.id}/pathogens/`);
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
