import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // 样板阶段：纯静态输出，便于部署到任意静态托管
  output: 'static',
  server: {
    port: 4321,
  },
});
