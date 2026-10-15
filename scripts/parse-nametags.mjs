/**
 * 名牌（Name Tag）解析脚本
 * ------------------------------------------------------------------
 * 数据源：资料/尸体派对/<作品>/03_<作品>_档案清单.csv
 *
 * 尸体派对的「档案清单」有两套表头：
 *   A 类（名牌型）：编号,类型,姓名（英）,姓名（中）,年龄,就读学校,死因/死法,章节,备注
 *                  编号,类型,姓名（英）,姓名（中）,年龄/性别,学校·班级,死因/死法,章节,位置,备注
 *   B 类（通用型）：编号,类型,名称（英/日）,名称（中）,所属章节,位置/条件,内容要点
 * 本脚本按「表头名」映射字段，两套表头都能解析；只保留 类型 含「名牌」且确实是具体人物的行，
 * 其余行（额外章节 / 结局 / 收集品 / 系统 等）不进死法图鉴。
 *
 * 用法：node scripts/parse-nametags.mjs
 * 产出：src/data/corpse-party/nametags.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');
const SRC_DIR = path.join(ROOT, '资料', '尸体派对');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'corpse-party', 'nametags.json');

/** 文件夹名关键词 → 作品 id / 标题 */
const WORKS = [
  { match: '血色笼罩', id: 'blood-covered', title: '尸体派对：血色笼罩', order: 1 },
  { match: '影之书', id: 'book-of-shadows', title: '尸体派对：影之书', order: 2 },
  { match: '驭血', id: 'blood-drive', title: '尸体派对：驭血', order: 3 },
  { match: '死亡病患', id: 'dead-patient', title: '尸体派对2：死亡病患', order: 4 },
  { match: '黑暗扭曲', id: 'darkness-distortion', title: '尸体派对II：黑暗扭曲', order: 5 },
  { match: '幸子小姐', id: 'sweet-sachiko', title: '尸体派对：幸子小姐的派对', order: 6 },
];

/** 表头名 → 内部字段 */
const HEADER_MAP = {
  '编号': 'id',
  '类型': 'type',
  '姓名（英）': 'nameEn',
  '姓名（中）': 'nameZh',
  '名称（英/日）': 'nameEn',
  '名称（中）': 'nameZh',
  '年龄': 'ageRaw',
  '年龄/性别': 'ageRaw',
  '就读学校': 'schoolRaw',
  '学校·班级': 'schoolRaw',
  '死因/死法': 'cause',
  '章节': 'chapter',
  '所属章节': 'chapter',
  '位置': 'location',
  '位置/条件': 'location',
  '备注': 'note',
  '内容要点': 'summary',
};

const UNKNOWN_TOKENS = ['未载', '未明确', '未收录', '公开来源未完整收录', '—', '-', ''];

// ---------- CSV 解析（最小 RFC4180 子集，支持双引号包裹与转义） ----------
function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, ''); // 去 UTF-8 BOM
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

// ---------- 死法归类 ----------
const DEATH_TYPES = [
  { key: 'suicide', label: '自杀·献祭', kw: ['自杀', '献出', '献祭', '殉', '一同自杀', '睡梦中死去'] },
  { key: 'starve', label: '窒息·饿死', kw: ['饿死', '脱水', '枯萎', '渴死', '溺', '窒息', '哮喘', '闷死'] },
  { key: 'fall', label: '坠落', kw: ['坠', '推下', '折颈', '骨折', '摔', '力竭'] },
  { key: 'blunt', label: '钝击', kw: ['钝器', '砸', '夹碎', '压碎', '压死', '被彻底压碎', '脑挫伤', '撞向', '殴打', '击打', '击裂', '击碎'] },
  { key: 'sharp', label: '锐器', kw: ['利器', '利刃', '刀', '割', '斩首', '劈', '划开', '刺', '剪断', '挖出', '砍', '一分为二', '解剖'] },
  { key: 'bleed', label: '失血', kw: ['失血', '流血', '休克'] },
  { key: 'other', label: '其他', kw: [] },
];
const UNKNOWN_TYPE = { key: 'unknown', label: '未明确' };

function classifyDeath(cause) {
  const text = String(cause || '').trim();
  if (!text || UNKNOWN_TOKENS.includes(text)) return UNKNOWN_TYPE;
  for (const t of DEATH_TYPES) {
    if (t.kw.some((k) => text.includes(k))) return { key: t.key, label: t.label };
  }
  return { key: 'other', label: '其他' };
}

// ---------- 字段规整 ----------
function splitSchool(raw) {
  const text = String(raw || '').trim();
  if (!text || UNKNOWN_TOKENS.includes(text)) return { school: '', schoolEn: '' };
  const m = text.match(/^(.+?)[（(](.+?)[)）]$/);
  if (m) return { school: m[1].trim(), schoolEn: m[2].trim() };
  return { school: text, schoolEn: '' };
}

function splitAge(raw) {
  const text = String(raw || '').trim();
  if (!text || UNKNOWN_TOKENS.includes(text)) return { age: '未载', gender: '' };
  const m = text.match(/^(\S+)\s+(\S+)$/);
  if (m) return { age: m[1], gender: m[2] };
  return { age: text, gender: '' };
}

function clean(v) {
  const t = String(v ?? '').trim();
  return UNKNOWN_TOKENS.includes(t) ? '' : t;
}

// ---------- 主流程 ----------
const entries = [];
const notes = [];

for (const work of WORKS) {
  const dir = fs.readdirSync(SRC_DIR, { withFileTypes: true })
    .find((d) => d.isDirectory() && d.name.includes(work.match));
  if (!dir) {
    console.warn(`[解析] 未找到文件夹（关键词：${work.match}），已跳过`);
    continue;
  }
  const folder = path.join(SRC_DIR, dir.name);
  const csvFile = fs.readdirSync(folder).find((f) => f.endsWith('_档案清单.csv'));
  if (!csvFile) {
    console.warn(`[解析] ${dir.name} 下无档案清单 CSV，已跳过`);
    continue;
  }

  const rows = parseCsv(fs.readFileSync(path.join(folder, csvFile), 'utf8'));
  const header = rows[0].map((h) => h.trim());
  const fields = header.map((h) => HEADER_MAP[h] || null);

  let kept = 0;
  for (const row of rows.slice(1)) {
    const rec = {};
    fields.forEach((f, i) => { if (f) rec[f] = row[i]; });

    const type = String(rec.type || '').trim();
    const nameZh = clean(rec.nameZh);
    const nameEn = clean(rec.nameEn);
    // 「名牌」本身作为名称的行是说明性条目（如死亡病患的 NT-NOTE），不是具体死者
    const isPlaceholder = /^名牌$/.test(nameZh) || /^name ?tags?$/i.test(nameEn);

    // 非名牌行：不进死法图鉴，但把「未收录」的说明性行摘出来当脚注
    if (!type.includes('名牌')) continue;
    if (type.includes('未收录') || isPlaceholder || (!nameZh && !nameEn)) {
      const note = [clean(rec.note), clean(rec.summary)].filter(Boolean).join(' ');
      if (note) notes.push(`《${work.title.replace(/^尸体派对[：2 I]*/, '')}》${note}`);
      else notes.push(`《${work.title}》名牌完整清单公开来源未公开。`);
      continue;
    }

    const { school, schoolEn } = splitSchool(rec.schoolRaw);
    const { age, gender } = splitAge(rec.ageRaw);
    const cause = clean(rec.cause);
    const death = classifyDeath(rec.cause);

    entries.push({
      id: clean(rec.id),
      work: work.id,
      workTitle: work.title,
      workOrder: work.order,
      nameZh: nameZh || nameEn,
      nameEn,
      age,
      gender,
      school,
      schoolEn,
      cause: cause || '未明确',
      deathType: death.key,
      deathLabel: death.label,
      chapter: clean(rec.chapter) || '未明确',
      location: clean(rec.location),
      note: clean(rec.note),
    });
    kept++;
  }
  console.log(`[解析] ${work.title}：收录名牌 ${kept} 条（CSV ${rows.length - 1} 行）`);
}

// 排序：作品顺序 → 章节 → 编号
const chapterNo = (s) => {
  const m = String(s).match(/(\d+)/);
  return m ? Number(m[1]) : 99;
};
entries.sort((a, b) => (
  a.workOrder - b.workOrder
  || chapterNo(a.chapter) - chapterNo(b.chapter)
  || a.id.localeCompare(b.id)
));

const out = {
  generatedAt: new Date().toISOString().slice(0, 10),
  DEATH_TYPES: DEATH_TYPES.map((t) => ({ key: t.key, label: t.label })).concat([{ key: UNKNOWN_TYPE.key, label: UNKNOWN_TYPE.label }]),
  notes,
  nametags: entries,
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n', 'utf8');

const byType = {};
for (const e of entries) byType[e.deathLabel] = (byType[e.deathLabel] || 0) + 1;
console.log(`\n[解析] 合计 ${entries.length} 条名牌 → ${path.relative(ROOT, OUT_FILE)}`);
console.log('[解析] 死法分布：', JSON.stringify(byType, null, 0));
if (notes.length) console.log('[解析] 脚注：\n  - ' + notes.join('\n  - '));
