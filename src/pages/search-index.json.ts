import type { APIRoute } from 'astro';
import { seriesList, typeLabels, clip } from '../lib/data.js';

/**
 * 站内搜索索引（构建期生成，纯静态、零依赖）。
 * ------------------------------------------------------------------
 * 为什么不用 Pagefind：它会索引整页 HTML —— 包括 C1 里被折叠起来的剧透正文，
 * 并自动生成包含死亡细节的摘要，等于从搜索结果里把剧透重新漏出来。
 * 这里改为「白名单式」索引：只收录 名称 / 别名 / 学校 / 章节 等**不剧透**的字段，
 * 摘要一律用站点自己控制的、本来就公开可见的文案（系列 intro / 作品 synopsis）。
 *
 * 说明：词条条目故意**不带简介**——词条的 summary 与 facts 里可能写着结局与死法，
 * 放进搜索摘要就成了剧透；点进词条页再看是更稳妥的顺序。
 */
export const GET: APIRoute = () => {
  const entries = [];

  for (const pack of seriesList) {
    const seriesName = pack.series.nameZh;
    const workTitleById = new Map(pack.works.map((w) => [w.id, w.title]));

    // 系列
    entries.push({
      kind: 'series',
      title: seriesName,
      en: pack.series.nameEn || '',
      badge: '系列',
      meta: `${pack.series.developer} · 首作 ${pack.series.firstRelease}`,
      desc: clip(pack.series.intro, 80),
      url: `/series/${pack.id}/`,
      key: [seriesName, pack.series.nameEn].filter(Boolean).join(' ').toLowerCase(),
    });

    // 作品
    for (const w of pack.works) {
      entries.push({
        kind: 'work',
        title: w.title,
        en: w.titleEn || '',
        badge: '作品',
        meta: `${seriesName} · ${w.year} · ${w.developer}`,
        desc: clip(w.synopsis, 80),
        url: `/work/${w.id}/`,
        key: [w.title, w.titleEn, seriesName, w.year].filter(Boolean).join(' ').toLowerCase(),
      });
    }

    // 词条（人物 / 地点 / 组织 / 物品……）：正文与别名表里出现什么，这里就能搜到什么
    for (const e of pack.entities) {
      const appeared = (e.works || []).map((id) => workTitleById.get(id)).filter(Boolean);
      entries.push({
        kind: 'entity',
        title: e.nameZh,
        en: e.nameEn || '',
        badge: typeLabels[e.type] || '词条',
        meta: `${seriesName}${appeared.length ? ' · 登场：' + appeared.join('、') : ''}`,
        desc: '',
        url: `/entity/${e.id}/`,
        key: [e.nameZh, e.nameEn, ...(e.aliases || []), seriesName]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      });
    }

    // 名牌（仅尸体派对）：摘要只给学校 / 章节等不含死因的字段，避免搜索结果泄底
    const nametags = (pack.nametags && pack.nametags.nametags) || [];
    for (const n of nametags) {
      entries.push({
        kind: 'nametag',
        title: n.nameZh,
        en: n.nameEn || '',
        badge: '名牌',
        meta: [n.school || '学校未载', n.chapter, n.workTitle].filter(Boolean).join(' · '),
        desc: '',
        url: `/series/${pack.id}/deaths/#nt-${n.id}`,
        key: [n.nameZh, n.nameEn, n.id, n.school, n.schoolEn, n.chapter, n.workTitle]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      });
    }
  }

  return new Response(JSON.stringify({ entries }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
