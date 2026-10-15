import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 样板阶段：纯静态输出，便于部署到任意静态托管
  output: 'static',
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
