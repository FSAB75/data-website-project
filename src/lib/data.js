/**
 * 数据层
 * ------------------------------------------------------------------
 * 站点以「系列」为单位组织内容：每个系列一个文件夹 src/data/<seriesId>/，
 * 内含 series.json / works.json / entities.json / timeline.json（可选 nametags.json 等扩展数据）。
 * 本模块用 import.meta.glob 在构建期扫描所有系列文件夹，**新增系列只需加一个文件夹**，无需改代码。
 *
 * 词条（entity）id 全局唯一：多系列共存时为不同系列加前缀（如尸体派对用 cp-）。
 * 正文的术语联动索引按系列隔离（见 lib/linkify.js），避免跨系列误命中。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_IMAGES = path.resolve(here, '../../public/images');

const modules = import.meta.glob('../data/*/*.json', { eager: true });

function unwrap(mod) {
  return mod && mod.default !== undefined ? mod.default : mod;
}

/** 扫描 src/data 下的各系列文件夹，组装系列注册表 */
function buildRegistry() {
  const buckets = new Map();
  for (const [file, mod] of Object.entries(modules)) {
    const m = file.match(/\/([^/]+)\/([^/]+)\.json$/);
    if (!m) continue;
    const [, seriesId, key] = m;
    if (!buckets.has(seriesId)) buckets.set(seriesId, {});
    buckets.get(seriesId)[key] = unwrap(mod);
  }

  const list = [];
  for (const [id, files] of buckets) {
    if (!files.series) continue; // 没有 series.json 的文件夹不视为系列
    list.push({
      id,
      series: files.series,
      works: (files.works && files.works.works) || [],
      entities: (files.entities && files.entities.entities) || [],
      timeline: files.timeline || { groups: [] },
      nametags: files.nametags || null,
    });
  }
  list.sort((a, b) => (a.series.order ?? 99) - (b.series.order ?? 99));
  return list;
}

/** 全部系列（每项含系列元数据与其下作品 / 词条 / 时间线 / 扩展数据） */
export const seriesList = buildRegistry();

/** 全部系列的全部作品 / 词条（扁平列表；id 全局唯一） */
export const works = seriesList.flatMap((s) => s.works);
export const entities = seriesList.flatMap((s) => s.entities);

/** 按 id 取系列数据包 */
export function getSeriesData(id) {
  return seriesList.find((s) => s.id === id) || null;
}

/** 按 id 取系列元数据 */
export function getSeries(id) {
  const s = getSeriesData(id);
  return s ? s.series : null;
}

/** 某系列下的作品（按 order 排序） */
export function worksOfSeries(seriesId) {
  const s = getSeriesData(seriesId);
  if (!s) return [];
  const ids = s.series.works || [];
  return s.works
    .filter((w) => ids.includes(w.id))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}

/** 某系列下的词条 */
export function entitiesOfSeries(seriesId) {
  const s = getSeriesData(seriesId);
  return s ? s.entities : [];
}

/** 某系列的时间线 */
export function timelineOfSeries(seriesId) {
  const s = getSeriesData(seriesId);
  return s ? s.timeline : { groups: [] };
}

/** 某系列 id 下的扩展数据（如名言牌 nametags） */
export function extraOfSeries(seriesId, key) {
  const s = getSeriesData(seriesId);
  return s ? s[key] || null : null;
}

/** 作品 → 所属系列数据包 */
export function seriesOfWork(workId) {
  return seriesList.find((s) => s.works.some((w) => w.id === workId)) || null;
}

/** 词条 → 所属系列数据包 */
export function seriesOfEntity(entityId) {
  return seriesList.find((s) => s.entities.some((e) => e.id === entityId)) || null;
}

/**
 * 取本地封面图路径。封面为构建期资产（存放在 public/images/），
 * 不使用运行时外部图片地址——这样朋友 clone 后在 IDEA 里能直接看到，
 * 将来部署到线上也不依赖任何外部服务。
 * 文件不存在时返回 null，页面自动不渲染封面。
 */
export function coverPath(kind, id) {
  const rel = `/images/${kind}/${id}.jpg`;
  const abs = path.join(PUBLIC_IMAGES, kind, `${id}.jpg`);
  return fs.existsSync(abs) ? rel : null;
}

export const typeLabels = {
  character: '人物',
  organization: '组织',
  experiment: '实验 / 技术',
  place: '地点',
  entity: '存在',
  ritual: '咒术 / 仪式',
  item: '物品',
  concept: '概念',
  incident: '事件',
};

/** 收集资料的条目类型 → 展示用短标签 */
export function docTypeLabel(type) {
  if (!type) return '档案';
  if (type === 'Note') return '录像';
  if (type === 'Document' || type === 'Evidence') return '文档';
  return type;
}

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

/** 按 id 取作品（全局） */
export function getWork(id) {
  return works.find((w) => w.id === id) || null;
}

/** 按 id 取实体（全局） */
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
 * 校验按系列分别进行，`characters` / `relations` 只在系列内闭合。
 */
function validateSeries(pack) {
  const problems = [];
  const { works, entities, timeline } = pack;
  const workIds = new Set(works.map((w) => w.id));
  const entityIds = new Set(entities.map((e) => e.id));
  const docIds = new Set();
  for (const w of works) {
    for (const d of w.documents || []) docIds.add(d.id);
  }

  for (const w of works) {
    for (const c of w.characters || []) {
      if (!entityIds.has(c)) problems.push(`[${pack.id}] 作品 ${w.id} 的 characters 引用了不存在的实体：${c}`);
    }
    for (const d of w.documents || []) {
      if (d.relatedEntity && !entityIds.has(d.relatedEntity)) {
        problems.push(`[${pack.id}] 作品 ${w.id} 的文档 ${d.id} 的 relatedEntity 指向不存在的实体：${d.relatedEntity}`);
      }
    }
  }

  for (const e of entities) {
    for (const d of e.relatedDocs || []) {
      if (!docIds.has(d)) problems.push(`[${pack.id}] 实体 ${e.id} 的 relatedDocs 引用了不存在的文档：${d}`);
    }
    for (const r of e.relations || []) {
      if (!entityIds.has(r.target)) problems.push(`[${pack.id}] 实体 ${e.id} 的 relations 引用了不存在的实体：${r.target}`);
    }
    for (const w of e.works || []) {
      if (!workIds.has(w)) problems.push(`[${pack.id}] 实体 ${e.id} 的 works 引用了不存在的作品：${w}`);
    }
  }

  for (const g of timeline.groups || []) {
    for (const ev of g.events || []) {
      for (const c of ev.characters || []) {
        if (!entityIds.has(c)) problems.push(`[${pack.id}] 时间线事件 ${ev.id} 的 characters 引用了不存在的实体：${c}`);
      }
      for (const w of ev.works || []) {
        if (!workIds.has(w)) problems.push(`[${pack.id}] 时间线事件 ${ev.id} 的 works 引用了不存在的作品：${w}`);
      }
    }
  }

  // 系列声明的 works 列表必须都存在
  for (const w of pack.series.works || []) {
    if (!workIds.has(w)) problems.push(`[${pack.id}] series.works 引用了不存在的作品：${w}`);
  }

  return problems;
}

/** 全局引用完整性检查（按系列分别校验 + 全局 id 唯一性） */
export function validateReferences() {
  const problems = [];
  for (const pack of seriesList) problems.push(...validateSeries(pack));

  const seenWork = new Set();
  const seenEntity = new Set();
  for (const pack of seriesList) {
    for (const w of pack.works) {
      if (seenWork.has(w.id)) problems.push(`作品 id 重复（跨系列冲突）：${w.id}`);
      seenWork.add(w.id);
    }
    for (const e of pack.entities) {
      if (seenEntity.has(e.id)) problems.push(`实体 id 重复（跨系列冲突）：${e.id}`);
      seenEntity.add(e.id);
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
