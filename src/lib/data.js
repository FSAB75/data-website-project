import seriesJson from '../data/outlast/series.json';
import worksJson from '../data/outlast/works.json';
import entitiesJson from '../data/outlast/entities.json';
import timelineJson from '../data/outlast/timeline.json';

/** 全部系列（样板阶段仅逃生一个） */
export const seriesList = [seriesJson];
export const series = seriesJson;
export const works = worksJson.works;
export const entities = entitiesJson.entities;
export const timeline = timelineJson;

export const typeLabels = {
  character: '人物',
  organization: '组织',
  experiment: '实验 / 技术',
  place: '地点',
  entity: '存在',
};

export const confidenceLabels = {
  '已核实': 'verified',
  '推测': 'inferred',
};

/** 时间线可信度 → CSS 类名 */
export function confidenceClass(confidence) {
  if (!confidence) return 'tag';
  const verified = confidence.includes('已核实');
  const inferred = confidence.includes('推测');
  if (verified && !inferred) return 'tag tag--verified';
  if (inferred && !verified) return 'tag tag--inferred';
  return 'tag';
}

/** 时间线可信度 → 展示文案 */
export function confidenceLabel(confidence) {
  if (!confidence) return '未明确';
  const verified = confidence.includes('已核实');
  const inferred = confidence.includes('推测');
  if (verified && inferred) return '已核实 / 推测';
  if (verified) return '已核实';
  if (inferred) return '推测';
  return '未明确';
}

/** 按 id 取作品 */
export function getWork(id) {
  return works.find((w) => w.id === id) || null;
}

/** 按 id 取实体 */
export function getEntity(id) {
  return entities.find((e) => e.id === id) || null;
}

/** 收集一个作品里所有可收集文档 */
export function getDocuments(workId) {
  const w = getWork(workId);
  return w && w.documents ? w.documents : [];
}

/**
 * 校验数据引用完整性：任何指向不存在 id 的引用都会被收集为问题项。
 * 用于在开发期尽早暴露 "断链"（例如 relatedDocs / relations / characters）。
 */
export function validateReferences() {
  const problems = [];
  const workIds = new Set(works.map((w) => w.id));
  const entityIds = new Set(entities.map((e) => e.id));
  const docIds = new Set();
  for (const w of works) {
    for (const d of w.documents || []) docIds.add(d.id);
  }

  for (const w of works) {
    for (const c of w.characters || []) {
      if (!entityIds.has(c)) problems.push(`作品 ${w.id} 的 characters 引用了不存在的实体：${c}`);
    }
    for (const d of w.documents || []) {
      if (d.relatedEntity && !entityIds.has(d.relatedEntity)) {
        problems.push(`作品 ${w.id} 的文档 ${d.id} 的 relatedEntity 指向不存在的实体：${d.relatedEntity}`);
      }
    }
  }

  for (const e of entities) {
    for (const d of e.relatedDocs || []) {
      if (!docIds.has(d)) problems.push(`实体 ${e.id} 的 relatedDocs 引用了不存在的文档：${d}`);
    }
    for (const r of e.relations || []) {
      if (!entityIds.has(r.target)) problems.push(`实体 ${e.id} 的 relations 引用了不存在的实体：${r.target}`);
    }
    for (const w of e.works || []) {
      if (!workIds.has(w)) problems.push(`实体 ${e.id} 的 works 引用了不存在的作品：${w}`);
    }
  }

  for (const g of timeline.groups || []) {
    for (const ev of g.events || []) {
      for (const c of ev.characters || []) {
        if (!entityIds.has(c)) problems.push(`时间线事件 ${ev.id} 的 characters 引用了不存在的实体：${c}`);
      }
      for (const w of ev.works || []) {
        if (!workIds.has(w)) problems.push(`时间线事件 ${ev.id} 的 works 引用了不存在的作品：${w}`);
      }
    }
  }

  return problems;
}

// 开发期自动做一次引用完整性检查，断链会直接打印到控制台
if (import.meta.env.DEV) {
  const problems = validateReferences();
  if (problems.length) {
    console.warn('[数据断链检查] 发现 ' + problems.length + ' 处引用问题：');
    for (const p of problems) console.warn('  - ' + p);
  } else {
    console.log('[数据断链检查] 通过，未发现断链。');
  }
}
