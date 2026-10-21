const fs = require('fs');
const path = require('path');
const ROOT = 'e:/Ai项目/游戏网站';
const IMG = path.join(ROOT, 'public/images/arsenal');

const seriesDirs = fs.readdirSync(path.join(ROOT, 'src/data'), { withFileTypes: true })
  .filter((d) => d.isDirectory()).map((d) => d.name);

const problems = [];
const used = new Set();
let modelTotal = 0;
let docsWithModels = 0;
const perSeries = {};

for (const sid of seriesDirs) {
  const p = path.join(ROOT, 'src/data', sid, 'works.json');
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  perSeries[sid] = { models: 0, docs: 0, imgs: 0 };
  const keys = new Set();
  const docIds = new Set();
  const hasModels = j.works.some((w) => (w.documents || []).some((d) => d.models));
  for (const w of j.works) {
    for (const d of w.documents || []) {
      if (hasModels) {
        if (docIds.has(d.id)) problems.push(`重复 doc id: ${d.id}`);
        docIds.add(d.id);
      }
      if (!d.models) continue;
      docsWithModels += 1;
      perSeries[sid].docs += 1;
      for (const m of d.models) {
        modelTotal += 1;
        perSeries[sid].models += 1;
        if (!m.key) problems.push(`${d.id} 型号缺 key: ${m.nameZh}`);
        else if (keys.has(m.key)) problems.push(`${d.id} 型号 key 重复: ${m.key}`);
        if (m.key) keys.add(m.key);
        if (!m.nameZh) problems.push(`${d.id} 型号缺 nameZh`);
        if (!m.sources || !m.sources.length) problems.push(`${d.id} / ${m.nameZh} 缺来源`);
        for (const im of m.images || []) {
          const f = path.join(IMG, `${im.file}.webp`);
          if (!fs.existsSync(f)) problems.push(`缺图: ${im.file}.webp（${d.id} / ${m.nameZh}）`);
          used.add(`${im.file}.webp`);
          perSeries[sid].imgs += 1;
        }
      }
    }
    for (const d of w.documents || []) {
      for (const im of d.images || []) {
        const f = path.join(IMG, `${im.file}.webp`);
        if (!fs.existsSync(f)) problems.push(`缺图: ${im.file}.webp（${d.id}）`);
        used.add(`${im.file}.webp`);
        perSeries[sid].imgs += 1;
      }
    }
  }
}

const files = fs.readdirSync(IMG).filter((f) => f.endsWith('.webp'));
const unused = files.filter((f) => !used.has(f));

console.log('图鉴配图文件:', files.length, '| 引用:', used.size, '| 未引用:', unused.length);
if (unused.length) console.log('  未引用示例:', unused.slice(0, 10).join(', '));
console.log('型号总数:', modelTotal, '| 含型号条目:', docsWithModels);
for (const [k, v] of Object.entries(perSeries)) {
  if (v.models || v.imgs) console.log(`  ${k}: ${v.models} 型号 / ${v.docs} 条目 / ${v.imgs} 图`);
}

// 搜索索引
const si = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/search-index.json'), 'utf8'));
const list = Array.isArray(si) ? si : si.entries || si.items;
const models = list.filter((e) => e.kind === 'model');
console.log('搜索索引 model 条目:', models.length);
if (!models.length) problems.push('搜索索引没有 model 条目');

// 页面存在性
for (const f of ['dist/series/resident-evil/arsenal/index.html']) {
  if (!fs.existsSync(path.join(ROOT, f))) problems.push(`缺页面: ${f}`);
}
for (const f of ['dist/series/forgive-me-father/arsenal/index.html', 'dist/series/forgive-me-father/bestiary/index.html']) {
  if (!fs.existsSync(path.join(ROOT, f))) problems.push(`缺页面: ${f}`);
}
{
  const f = 'dist/series/forgive-me-father/arsenal/index.html';
  const html = fs.existsSync(path.join(ROOT, f)) ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '';
  if (!html.includes('个具体型号')) problems.push(`${f} 没有型号数标签`);
}
const fmfHtml = fs.readFileSync(path.join(ROOT, 'dist/series/forgive-me-father/arsenal/index.html'), 'utf8');
for (const n of ['诺勒 G40', '鲸之灾', '折磨者', '可疑箱子', '绽放虹吸']) {
  if (!fmfHtml.includes(n)) problems.push(`宽恕我神父图鉴缺型号: ${n}`);
}
const fmfSrc = fs.readFileSync(path.join(ROOT, 'dist/series/forgive-me-father/bestiary/index.html'), 'utf8');
if (fmfSrc.includes('Evil Resource')) problems.push('宽恕我神父怪物图鉴仍写着 Evil Resource 来源');

console.log(problems.length ? `\n发现 ${problems.length} 处问题:` : '\n全部断言通过');
for (const p of problems) console.log(' -', p);
process.exitCode = problems.length ? 1 : 0;
