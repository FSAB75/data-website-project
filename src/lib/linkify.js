/**
 * 术语高亮联动引擎
 * ------------------------------------------------------------------
 * 设计：正文保持"干净"的自然语言，不写任何标记。
 * 引擎用「实体别名表」扫描文本，命中后把词包裹成可交互元素：
 *   - 悬停 / 聚焦 → 弹出词条卡片（纯 CSS，无需 JS）
 *   - 点击 → 跳转到对应词条详情页
 * 关键规则：**最长别名优先**（"瓦尔里德计划" 先于 "瓦尔里德"，
 * "克里斯·沃克" 先于 "沃克"，"巨山精神病院" 先于 "巨山"）。
 */

import { typeLabels } from './data.js';

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(input) {
  return String(input).replace(/[&<>"']/g, (c) => ESCAPE_MAP[c]);
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 构建实体索引：别名表 + 最长优先的正则 + 实体查找表
 */
export function buildEntityIndex(entityList) {
  const aliasMap = new Map();
  const byId = new Map();

  for (const entity of entityList) {
    byId.set(entity.id, entity);
    const names = [entity.nameZh, entity.nameEn, ...(entity.aliases || [])].filter(Boolean);
    for (const name of names) {
      if (!aliasMap.has(name)) aliasMap.set(name, entity.id);
    }
  }

  const aliases = [...aliasMap.keys()].sort((a, b) => b.length - a.length);
  const pattern = aliases.length ? new RegExp('(' + aliases.map(escapeRegExp).join('|') + ')', 'g') : null;

  return { aliasMap, byId, pattern };
}

function renderCard(entity, matchedText) {
  const type = typeLabels[entity.type] || '词条';
  const en = entity.nameEn ? `<span class="term__en">${escapeHtml(entity.nameEn)}</span>` : '';
  const other = matchedText !== entity.nameZh ? `<span class="term__alias">正文中作“${escapeHtml(matchedText)}”</span>` : '';
  return (
    `<a class="term" href="/entity/${entity.id}/">` +
    `<span class="term__hit">${escapeHtml(matchedText)}</span>` +
    `<span class="term__card" role="tooltip">` +
    `<span class="term__card-head"><span class="term__name">${escapeHtml(entity.nameZh)}</span>${en}</span>` +
    `<span class="term__type">${escapeHtml(type)}</span>` +
    other +
    `<span class="term__desc">${escapeHtml(entity.summary || '')}</span>` +
    `<span class="term__more">查看完整词条 →</span>` +
    `</span>` +
    `</a>`
  );
}

/**
 * 把一段文本渲染成带词条联动的 HTML。
 * @param {string} text 原始文本
 * @param {object} index 由 buildEntityIndex 构建的索引
 * @param {Set<string>} seen 已联动过的实体集合（用于「同一段落内每个词条只联动一次」）
 */
export function linkify(text, index, seen = new Set()) {
  if (!text || !index || !index.pattern) return escapeHtml(text || '');
  return text.replace(index.pattern, (match) => {
    const id = index.aliasMap.get(match);
    if (!id) return escapeHtml(match);
    if (seen.has(id)) return escapeHtml(match);
    seen.add(id);
    const entity = index.byId.get(id);
    if (!entity) return escapeHtml(match);
    return renderCard(entity, match);
  });
}
