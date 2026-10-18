#!/usr/bin/env node
/**
 * NAS 一键部署脚本
 * ------------------------------------------------------------------
 * 做什么：本地构建 → 打包 → 通过 SSH 传到 NAS → 解包 → 校验
 *
 * 用法（在项目根目录）：
 *   node scripts/deploy-nas.mjs                 构建 + 上传 + 校验
 *   node scripts/deploy-nas.mjs --no-build      跳过构建，只上传现有的 dist
 *   node scripts/deploy-nas.mjs --up            上传后额外执行 sudo docker compose up -d
 *   node scripts/deploy-nas.mjs --run "命令"     只在 NAS 上执行一条命令（带 sudo）
 *
 * 连接信息（**不要把密码写进本文件或任何会被提交的文件**）：
 *   优先级 1：环境变量  NAS_HOST / NAS_USER / NAS_PASS
 *   优先级 2：本地文件  scripts/.nas-credentials.json（已 gitignore）
 *             内容形如：{ "host": "10.216.0.182", "username": "账号", "password": "密码" }
 *
 * 可用环境变量：NAS_PORT（默认 22）、NAS_REMOTE_DIR（默认 /volume1/docker/game-wiki）
 *
 * 依赖：ssh2（devDependency）。第一次使用先执行 npm install。
 *      打包用系统自带的 tar 命令（Windows 10+ / macOS / Linux 都有）。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from 'ssh2';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const REMOTE_DIR = process.env.NAS_REMOTE_DIR || '/volume1/docker/game-wiki';
const REMOTE_PORT = Number(process.env.NAS_PORT || 22);

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const valueOf = (f) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : undefined;
};

function loadConfig() {
  const localFile = path.join(HERE, '.nas-credentials.json');
  let local = {};
  if (fs.existsSync(localFile)) {
    try {
      local = JSON.parse(fs.readFileSync(localFile, 'utf8'));
    } catch (e) {
      console.error('[错误] ' + path.relative(ROOT, localFile) + ' 不是合法的 JSON：' + e.message);
      process.exit(2);
    }
  }
  const cfg = {
    host: process.env.NAS_HOST || local.host,
    username: process.env.NAS_USER || local.username,
    password: process.env.NAS_PASS || local.password,
  };
  if (!cfg.host || !cfg.username || !cfg.password) {
    console.error('缺少 NAS 连接信息。二选一：');
    console.error('  1) 设置环境变量：NAS_HOST / NAS_USER / NAS_PASS');
    console.error('  2) 新建本地文件 ' + path.relative(ROOT, localFile) + '（已 gitignore，不会被提交）：');
    console.error('     { "host": "10.216.0.182", "username": "账号", "password": "密码" }');
    process.exit(2);
  }
  if (!fs.existsSync(localFile)) console.log('（使用环境变量作为连接信息）');
  return cfg;
}

function connect(cfg) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', (e) => reject(new Error('连接失败：' + e.message)))
      .connect({ host: cfg.host, port: REMOTE_PORT, username: cfg.username, password: cfg.password, readyTimeout: 25000 });
  });
}

/** 在远端执行一条命令；stdin 可传文件的读流，password 可满足 sudo 的密码询问 */
function execRemote(conn, command, { stdinPath, passwordForSudo } = {}) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => (out += d.toString()));
      stream.stderr.on('data', (d) => (out += d.toString()));
      stream.on('close', (code) => resolve({ code, out }));
      if (stdinPath) fs.createReadStream(stdinPath).pipe(stream);
      else if (passwordForSudo) stream.end(passwordForSudo + '\n');
      else stream.end();
    });
  });
}

/** 需要 sudo 的命令：把密码喂给 sudo -S 的标准输入 */
const withSudo = (command) => `sudo -S bash -c ${JSON.stringify(command)}`;

/** 从本地 dist/sitemap.xml 里取几条有代表性的路径做校验（新增系列 / 页面会自动被覆盖到） */
function samplePathsFromSitemap(max = 8) {
  const p = path.join(ROOT, 'dist', 'sitemap.xml');
  if (!fs.existsSync(p)) return ['/'];
  const locs = [...fs.readFileSync(p, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''))
    .filter(Boolean);
  if (!locs.length) return ['/'];
  const step = Math.max(1, Math.floor(locs.length / (max - 1)));
  const picked = ['/'];
  for (let i = 0; i < locs.length && picked.length < max; i += step) picked.push(locs[i]);
  return [...new Set(picked)];
}

function buildTarball() {
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'game-wiki-stage-'));
  const distSrc = path.join(ROOT, 'dist');
  if (!fs.existsSync(distSrc)) throw new Error('找不到 dist/，请先执行 npm run build（或去掉 --no-build）');

  fs.cpSync(distSrc, path.join(stage, 'dist'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'docker', 'nginx.conf'), path.join(stage, 'nginx.conf'));
  fs.copyFileSync(path.join(ROOT, 'docker-compose.mount.yml'), path.join(stage, 'docker-compose.yml'));

  const tarPath = path.join(stage, '..', path.basename(stage) + '.tar.gz');
  execFileSync('tar', ['-czf', tarPath, '-C', stage, '.'], { stdio: 'inherit' });
  const mb = (fs.statSync(tarPath).size / 1024 / 1024).toFixed(2);
  console.log(`[打包] ${mb} MB → ${tarPath}`);
  return { tarPath, stage };
}

async function main() {
  const cfg = loadConfig();

  // 模式一：只在 NAS 上跑一条命令
  const runCmd = valueOf('--run');
  if (runCmd) {
    console.log(`[远端] sudo 执行：${runCmd}`);
    const conn = await connect(cfg);
    const { code, out } = await execRemote(conn, withSudo(runCmd), { passwordForSudo: cfg.password });
    process.stdout.write(out);
    conn.end();
    console.log(`[退出码 ${code}]`);
    process.exit(code === 0 ? 0 : 1);
  }

  // 模式二：完整部署
  if (!has('--no-build')) {
    console.log('[1/4] 本地构建');
    // Windows 上 npm 是 npm.cmd 批处理文件：Node 对 .cmd 的 spawn 要求 shell: true，否则报 spawnSync EINVAL。
    // 这里把整条命令作为单个字符串交给 shell，避免「args + shell:true」触发的 DEP0190 警告。
    execFileSync('npm run build', { cwd: ROOT, stdio: 'inherit', shell: true });
  } else {
    console.log('[1/4] 跳过构建（--no-build）');
  }

  console.log('[2/4] 打包');
  const { tarPath, stage } = buildTarball();

  console.log(`[3/4] 上传到 ${cfg.host}:${REMOTE_DIR}`);
  const conn = await connect(cfg);
  const mk = await execRemote(conn, `mkdir -p ${REMOTE_DIR} && echo READY`);
  if (mk.code !== 0) throw new Error('远端建目录失败：' + mk.out);
  const up = await execRemote(conn, `tar -xzf - -C ${REMOTE_DIR} && echo UNPACK_OK`, { stdinPath: tarPath });
  process.stdout.write(up.out);
  if (!up.out.includes('UNPACK_OK')) throw new Error('远端解包失败');

  // nginx.conf 是「按单个文件」绑定挂载进容器的：tar 解包是删除 + 新建，inode 会变，
  // 而容器仍然指着旧 inode —— 新配置不会生效（nginx -s reload 也只是重载旧文件）。
  // 这里比对容器内外的配置指纹，不一致就重启站点容器让它重新绑定。
  const CONTAINER = process.env.NAS_CONTAINER || 'game-wiki';
  const drift = await execRemote(
    conn,
    withSudo(
      `a=$(md5sum ${REMOTE_DIR}/nginx.conf | cut -d' ' -f1); ` +
        `b=$(docker exec ${CONTAINER} md5sum /etc/nginx/conf.d/default.conf 2>/dev/null | cut -d' ' -f1); ` +
        `[ -n "$b" ] && [ "$a" != "$b" ] && echo DRIFT || echo SAME`
    ),
    { passwordForSudo: cfg.password }
  );
  if (drift.out.includes('DRIFT')) {
    console.log('[配置] nginx.conf 有变更 → 重启站点容器，让新配置真正生效');
    const rs = await execRemote(conn, withSudo(`docker restart ${CONTAINER}`), { passwordForSudo: cfg.password });
    process.stdout.write(rs.out);
    await new Promise((r) => setTimeout(r, 5000));
  } else {
    console.log('[配置] nginx.conf 与容器内一致，无需重启');
  }

  console.log('[4/4] 校验');
  const sample = samplePathsFromSitemap();
  const check = await execRemote(
    conn,
    `for p in ${sample.map((s) => `'${s}'`).join(' ')} ; do ` +
      `printf '%s  %s\\n' "$(curl -sS -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080$p)" "$p"; done; ` +
      `printf '%s  %s\\n' "$(curl -sS -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:8080/no-such-page-xyz/)" "任意错路径（应为 404）"; ` +
      `du -sh ${REMOTE_DIR}`
  );
  process.stdout.write(check.out);

  if (has('--up')) {
    console.log('[附加] 重启 compose 项目');
    const up2 = await execRemote(conn, withSudo(`cd ${REMOTE_DIR} && docker compose up -d`), { passwordForSudo: cfg.password });
    process.stdout.write(up2.out);
    const logs = await execRemote(conn, withSudo(`docker logs game-wiki-tunnel 2>&1 | grep -o 'https://[a-z0-9-]*\\.trycloudflare\\.com' | tail -1`), {
      passwordForSudo: cfg.password,
    });
    const url = logs.out.trim();
    if (url) console.log(`[公网地址] ${url}`);
  }

  conn.end();
  fs.rmSync(stage, { recursive: true, force: true });
  fs.rmSync(tarPath, { force: true });
  console.log('\n[完成] 部署成功。内网地址：http://' + cfg.host + ':8080/');
  console.log('       内容更新后 nginx 不缓存 HTML，刷新浏览器即可生效，无需重启容器；');
  console.log('       若本次改动了 docker/nginx.conf，脚本会自动检测并重启站点容器。');
}

main().catch((e) => {
  console.error('\n[失败] ' + e.message);
  process.exit(1);
});
