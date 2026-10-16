import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 样板阶段：纯静态输出，便于部署到任意静态托管
  output: 'static',

  // 正式对外域名尚未确定（见 待优化清单.md 的 F4：无公网 IP / 无 IPv6，只能走穿透）。
  // 这里用内网地址占位，保证 canonical、og:image 与 sitemap 都是完整的绝对地址。
  // 买到域名后：设置环境变量 SITE_URL（或直接改这一行）再重新构建即可。
  site: process.env.SITE_URL || 'http://10.216.0.182:8080',
  server: {
    port: 4321,
  },
  vite: {
    server: {
      // 开发服务器默认只接受 localhost 的 Host 头。
      // 这里放行 Cloudflare 隧道域名，便于把本地预览临时分享给别人看效果。
      // 仅影响 `npm run dev`；不影响 `npm run build` 出的静态产物。
      allowedHosts: ['.trycloudflare.com'],
    },
  },
});
