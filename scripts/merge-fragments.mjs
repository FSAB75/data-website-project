/**
 * 片段合并脚本
 * ------------------------------------------------------------------
 * 尸体派对剩余作品的资料由多个片段文件并行产出，最后统一合并进三份主数据文件：
 *   works.json / entities.json / timeline.json
 *
 * 片段格式（放在 src/data/corpse-party/_fragments/<workId>.json）：
 * {
 *   "workId": "book-of-shadows",
 *   "work":   { ...要覆盖到该作品对象上的字段（chapters / sideChapters / documents / connections / characters / full 等）... },
 *   "entities": [ ...该作品新增的实体，id 以 cp- 开头，**不要重复已有 id**... ],
 *   "timeline": [ ...要追加到系列时间线末尾的时代分组... ]
 * }
 *
 * 合并规则：
 *   - work：按 id 合并覆盖（保留原有 id）
 *   - entities：只追加新 id；已存在的 id 会跳过并告警（避免覆盖已写好的实体）
 *   - timeline：按 ORDER 中列出的作品顺序追加分组
 *
 * 用法：node scripts/merge-fragments.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'src', 'data', 'corpse-party');
const FRAG_DIR = path.join(DIR, '_fragments');

/** 时间线分组的追加顺序（按系列年代） */
const ORDER = ['book-of-shadows', 'blood-drive', 'dead-patient', 'darkness-distortion', 'sweet-sachiko'];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n', 'utf8');

const worksFile = path.join(DIR, 'works.json');
const entFile = path.join(DIR, 'entities.json');
const tlFile = path.join(DIR, 'timeline.json');

const worksDoc = readJson(worksFile);
const entDoc = readJson(entFile);
const tlDoc = readJson(tlFile);

if (!fs.existsSync(FRAG_DIR)) {
  console.log('[merge] 没有片段目录，无需合并。');
  process.exit(0);
}

const files = fs.readdirSync(FRAG_DIR).filter((f) => f.endsWith('.json'));
const frags = files.map((f) => readJson(path.join(FRAG_DIR, f)));
const byId = new Map(frags.map((f) => [f.workId, f]));
const ordered = ORDER.filter((id) => byId.has(id)).map((id) => byId.get(id))
  .concat(frags.filter((f) => !ORDER.includes(f.workId)));

let addedEntities = 0;
for (const frag of ordered) {
  if (!frag.workId) { console.warn('[merge] 片段缺少 workId，已跳过：', frag); continue; }

  if (frag.work) {
    const idx = worksDoc.works.findIndex((w) => w.id === frag.workId);
    if (idx >= 0) {
      worksDoc.works[idx] = { ...worksDoc.works[idx], ...frag.work, id: frag.workId };
      console.log(`[merge] 作品 ${frag.workId} 已合并 ${Object.keys(frag.work).length} 个字段`);
    } else {
      console.warn(`[merge] works.json 中找不到作品 ${frag.workId}，已跳过作品补丁`);
    }
  }

  for (const e of frag.entities || []) {
    if (!e.id) { console.warn('[merge] 实体缺少 id，已跳过'); continue; }
    if (entDoc.entities.some((x) => x.id === e.id)) {
      console.warn(`[merge] 实体 ${e.id} 已存在，跳过（避免覆盖已有内容）`);
      continue;
    }
    entDoc.entities.push(e);
    addedEntities++;
  }

  for (const g of frag.timeline || []) tlDoc.groups.push(g);

  console.log(`[merge] ${frag.workId}：新增实体 ${(frag.entities || []).length} 条、时间线分组 ${(frag.timeline || []).length} 个`);
}

writeJson(worksFile, worksDoc);
writeJson(entFile, entDoc);
writeJson(tlFile, tlDoc);

console.log(`\n[merge] 共合并 ${ordered.length} 个片段；实际新增实体 ${addedEntities} 个；` +
  `实体总数 ${entDoc.entities.length}；作品总数 ${worksDoc.works.length}；时间线分组 ${tlDoc.groups.length}`);
