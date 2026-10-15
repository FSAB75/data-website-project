# 游戏科普网站

以**「游戏系列」为单位**的剧情 / 世界观科普百科站。

## 站点结构

```
系列（Series）
├── 系列主页 —— 作品卡片列表 + 世界观时间轴 + 系列专属子页
└── 作品（Work）
    ├── 主线剧情
    ├── 支线剧情
    ├── 人物图鉴
    ├── 收集资料
    └── 剧情连接
```

## 核心特性

- **世界观时间轴**：某时发生什么大事件，哪部作品的哪个角色在经历什么
- **术语高亮联动**：剧情正文中的人名、实验 / 项目名、组织名、地名等关键词高亮可交互，
  悬停弹出卡片，或跳转到词条详情页 / 游戏内文档条目（词条索引按系列隔离，不会跨系列误命中）
- **系列专属模块**：不同系列可有自己的模块与视觉基调，例如《尸体派对》的**死法收集图鉴**
  （名牌卡片墙 + 按作品 / 章节 / 学校 / 死法类型筛选 + 姓名搜索）与其「和风校园怪谈」主题

## 已收录系列

| 系列 | 作品 | 特色 | 状态 |
|------|------|------|------|
| 逃生 | 逃生1 / 告密者 / 逃生2 / 试炼 | 强化世界观时间轴 | ✅ 4 部作品（52 个词条） |
| 尸体派对 | 血色笼罩 / 影之书 / 驭血 / 死亡病患 / 黑暗扭曲 / 幸子小姐的派对 | 死法收集图鉴（116 条名牌） | ✅ 6 部作品（91 个词条） |

> 《尸体派对II：黑暗扭曲》（2026 新作）公开资料尚不完整，本站按现有资料收录，
> 缺项一律标注「未明确 / 公开来源未完整收录」，不作臆造。

## 协作

- 远程仓库：Gitee（`sun-jiaheng123/data-website-project`）
- 开发工具：IntelliJ IDEA / Trae，通过 Git 同步

## 内容结构：加一个系列 = 加一个文件夹

内容全部是 `src/data/<系列 id>/` 下的 JSON，页面由模板自动生成。数据层用 `import.meta.glob`
扫描 `src/data/` 下的所有系列文件夹，**新增系列不需要改任何代码**。

```
src/data/<seriesId>/
├── series.json    系列元数据（名称 / 简介 / theme 主题 / works 作品 id 列表 / entityCount）
├── works.json     该系列全部作品（章节 / 支线 / 人物 id / 档案 / 剧情连接）
├── entities.json  该系列全部词条（人物 / 地点 / 组织 / 物品 / 咒术 / 概念…）
├── timeline.json  该系列世界观时间线（按 era 分组，可含 dual 双轨与 crossings 交汇）
└── nametags.json  可选：系列专属扩展数据（如尸体派对的 116 条名牌）
```

### 约定（很重要）

- **词条 id 全站唯一**：新系列请给自己的词条加前缀（逃生无前缀，尸体派对统一用 `cp-`），
  否则跨系列 id 冲突会被开发期自检报出来。
- **别名要写全、长的在前**：联动引擎按「最长别名优先」匹配，所以 `篠崎幸子` 会先于 `幸子` 命中；
  正文里**不要写任何标记语法**（没有 `[[ ]]`），引擎会自动把名字高亮成可交互词条。
- **`series.json` 的 `theme`** 决定视觉基调（现成：`outlast` 暗黑恐怖风 / `corpse-party` 和风校园怪谈）。
- **收集资料的 `content` 是「编者解说」**：基于公开资料的背景说明，**不是游戏内原文转录**。
- 开发期自动做引用完整性自检（`npm run dev` 时打印到控制台）——任何指向不存在 id 的引用都会报「断链」。

### 两个辅助脚本

```bash
node scripts/parse-nametags.mjs      # 解析 资料/尸体派对/*/03_*_档案清单.csv → nametags.json（含死法类型自动归类）
node scripts/merge-fragments.mjs     # 把 _fragments/*.json 的并行内容片段合并进 works/entities/timeline
```

## 本地开发

```bash
npm install
npm run dev      # 起本地预览：http://localhost:4321/
npm run build    # 产出静态站点到 dist/
```

> 国内网络建议先把 npm 源切到 npmmirror：
> `npm config set registry https://registry.npmmirror.com`

## 部署（Docker / 绿联 NAS）

站点是纯静态产物，**运行时不需要 Node 常驻进程**，只用一个 nginx 容器托管 `dist/` 即可，资源占用极小。

### 方式 A（推荐，速度快）：本地构建 + 挂载 dist

1. 本地执行 `npm run build`，得到 `dist/`
2. 把 `dist/` 与 `docker/nginx.conf` 拷到 NAS 共享文件夹，例如 `/volume1/docker/game-wiki/`
3. 在 NAS（绿联 UGOS 的 Docker 应用 → 项目 / Compose）新建项目，compose 内容：

```yaml
name: game-wiki
services:
  web:
    image: nginx:1.27-alpine
    container_name: game-wiki
    restart: unless-stopped
    ports:
      - "8080:80"
    volumes:
      - /volume1/docker/game-wiki/dist:/usr/share/nginx/html:ro
      - /volume1/docker/game-wiki/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    environment:
      - TZ=Asia/Shanghai
```

4. 启动后访问 `http://NAS内网IP:8080/`

### 方式 B：容器内构建（git clone 后一条命令）

把仓库 clone 到 NAS，在项目根目录执行：

```bash
docker compose up -d --build
```

NAS 的 CPU 较弱，首次构建会偏慢（Dockerfile 已默认使用 npmmirror 源）。

### 内容更新

- 方式 A：重新 `npm run build` → 覆盖 NAS 上的 `dist/`（容器无需重启，HTML 已配置为不缓存）
- 方式 B：`git pull` 后 `docker compose up -d --build`

### 对外访问（先自查网络条件）

内网访问（`http://NAS内网IP:8080/`）随时可用。能否“持续对外提供服务”，取决于家庭网络的实际情况：

- **公网 IPv4**：登录路由器，对比 WAN 口 IP 与在终端执行 `curl ifconfig.me` 得到的出口 IP。
  两者不同即说明是运营商 CGNAT（没有公网 IP）。有公网 IP 时可做 DDNS + 使用非标准端口（如 8080 / 8443）。
  注意：国内家宽对 **80 / 443 端口普遍封锁**，且域名解析到家庭宽带涉及 **ICP 备案** 问题。
- **无公网 IP**：可选 IPv6（若运营商支持），或 **frp 内网穿透**（需要一台有公网 IP 的服务器做中转）。
- **安全红线**：只暴露 nginx 容器的端口，**绝不要把 NAS 管理界面暴露到公网**。

> 如果外网条件不理想，也可以把纯静态站托管到 Cloudflare Pages / Vercel / Gitee Pages 作为正式对外入口，NAS 则作为内网镜像使用。
