/**
 * 把图鉴配图批量转成 WebP（本站图鉴统一用 .webp，见 待优化清单 J4 ⑧）。
 *
 * 用法：
 *   node scripts/to-webp.cjs                # 默认转换 public/images/arsenal
 *   node scripts/to-webp.cjs <目录>          # 指定其它目录
 *   node scripts/to-webp.cjs <目录> --delete # 转换成功后删掉原 PNG
 *
 * 小图（长边 ≤200px）用 quality 82，大图用 quality 86；透明通道保留（alphaQuality 100）。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const dir = path.resolve(ROOT, args.find((a) => !a.startsWith('--')) || 'public/images/arsenal');
const removeSource = args.includes('--delete');

const files = fs.readdirSync(dir).filter((f) => /\.(png|jpe?g)$/i.test(f));
if (!files.length) {
  console.log(`${dir} 里没有待转换的 PNG / JPG`);
  process.exit(0);
}

(async () => {
  let before = 0;
  let after = 0;
  let failed = 0;

  await Promise.all(
    files.map(async (f) => {
      const src = path.join(dir, f);
      const dst = path.join(dir, f.replace(/\.(png|jpe?g)$/i, '.webp'));
      try {
        const { size } = fs.statSync(src);
        const meta = await sharp(src).metadata();
        const longEdge = Math.max(meta.width || 0, meta.height || 0);
        await sharp(src)
          .webp({ quality: longEdge <= 200 ? 82 : 86, alphaQuality: 100, effort: 6, smartSubsample: true })
          .toFile(dst);
        before += size;
        after += fs.statSync(dst).size;
        if (removeSource) fs.unlinkSync(src);
      } catch (e) {
        failed += 1;
        console.log('转换失败：', f, e.message);
      }
    }),
  );

  const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
  console.log(
    `转换 ${files.length - failed} / ${files.length} 张：${mb(before)} → ${mb(after)}` +
      `（压掉 ${(100 - (after / before) * 100).toFixed(1)}%）${removeSource ? '，原图已删除' : ''}`,
  );
  if (failed) process.exitCode = 1;
})();
