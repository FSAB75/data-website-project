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

- **远程仓库**：GitHub —— `git@github.com:FSAB75/data-website-project.git`（远端名 `origin`）
- **分支**：`master`
- 旧的 Gitee 仓库（远端名 `gitee`）**已停止同步，仅作历史备份，平时不用推**
- 日常三步：`git pull` → 改 → `git push`
- 开发工具：IntelliJ IDEA / Trae，通过 Git 同步
- **协作者要准备「自己的」GitHub 账号与 SSH 公钥**，不要共用别人的密钥

### 协作纪律（避免互相覆盖）

- **严禁 `git push --force`**，也不要 rebase 已推送的提交 —— 这是唯一会真正抹掉别人提交的操作
- 动手前先 `git pull`，改完立刻 `git push`；**提交粒度尽量小**（一个系列 / 一个功能一次提交）
- 按 `src/data/<系列>/` 文件夹分工，各改各的系列，天然不冲突
- **改公共文件前先打招呼**：`astro.config.mjs`、`package.json` / `package-lock.json`、`README.md`、`待优化清单.md`、`src/layouts/BaseLayout.astro`
- **加依赖只由一个人做**，做完推上去、另一个人 `npm install` 同步（否则 `package-lock.json` 必冲突）
- `src/data/*/nametags.json` 是脚本生成的产物，**不要手工改**；要改就改源 CSV，再重跑 `scripts/parse-nametags.mjs`

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

### 几个辅助脚本

```bash
node scripts/parse-nametags.mjs      # 解析 资料/尸体派对/*/03_*_档案清单.csv → nametags.json（含死法类型自动归类）
node scripts/merge-fragments.mjs     # 把 _fragments/*.json 的并行内容片段合并进 works/entities/timeline
node scripts/deploy-nas.mjs          # 一键部署到绿联 NAS（构建 → 打包 → 上传 → 校验）
```

## 本地开发

```bash
npm install
npm run dev      # 起本地预览：http://localhost:4321/
npm run build    # 产出静态站点到 dist/
```

> 国内网络建议先把 npm 源切到 npmmirror：
> `npm config set registry https://registry.npmmirror.com`

## 部署（绿联 NAS + Docker，已实操验证）

站点是纯静态产物，**运行时不需要 Node 常驻进程**，一个 nginx 容器托管 `dist/` 即可，资源占用极小。

### 为什么不做「容器内构建」

NAS（绿联 DH4300 PLUS，ARM aarch64）上**没有 git / npm**，而且 CPU 较弱。
所以走「**本地构建 → 上传 dist → NAS 只挂载**」这条路：NAS 端只需要一个 nginx 镜像，秒级启动。

### 一键部署（推荐）

先把连接信息放进一个**不会被提交**的本地文件（已在 `.gitignore` 里）：

```json
// scripts/.nas-credentials.json
{ "host": "10.216.0.182", "username": "你的NAS账号", "password": "你的密码" }
```

也可以用环境变量 `NAS_HOST / NAS_USER / NAS_PASS` 代替。
**绝对不要把密码写进任何会被提交的文件。**

随后：

```bash
node scripts/deploy-nas.mjs              # 构建 + 打包 + 上传 + 校验
node scripts/deploy-nas.mjs --no-build   # 只上传现有 dist（跳过构建）
node scripts/deploy-nas.mjs --up         # 额外执行 sudo docker compose up -d
node scripts/deploy-nas.mjs --run "命令"  # 只在 NAS 上跑一条命令（带 sudo）
```

脚本流程：本地 `npm run build` → 连同 `docker/nginx.conf`、`docker-compose.mount.yml` 一起打包
→ 经 SSH 传到 `/volume1/docker/game-wiki/` → 解包 → 用 curl 校验首页与几个关键页。

### NAS 上的目录结构

```
/volume1/docker/game-wiki/
├── docker-compose.yml   ← 来自仓库的 docker-compose.mount.yml
├── nginx.conf           ← 来自仓库的 docker/nginx.conf
└── dist/                ← 本地构建产物
```

首次部署后在 NAS 上起容器（之后改内容**不用**再执行）：

```bash
cd /volume1/docker/game-wiki && sudo docker compose up -d
```

> 绿联 UGOS 自己占用了 `80 / 443 / 9999`，所以站点用 `8080`。

### 内容更新

```bash
node scripts/deploy-nas.mjs     # 一条命令
```

**不需要重启容器** —— nginx 已配置 HTML 不缓存，刷新浏览器就是新版。

### 对外访问（内网穿透）

先自查网络条件再选路线：

| 路线 | 需要什么 | 说明 |
|---|---|---|
| **Cloudflare Tunnel（推荐）** | 阶段一不用域名；阶段二需要域名 | 不需要公网 IP、不需要开端口，HTTPS 自动；免费不限流量 |
| DDNS + 端口映射 | 公网 IPv4 + 域名 | 国内家宽普遍封 80/443，域名解析到家宽涉及 **ICP 备案** |
| IPv6 | 运营商提供 IPv6 | 访问方也要支持 IPv6 |
| frp 等穿透 | 一台有公网 IP 的中转服务器 | 要额外维护 |

**Cloudflare Tunnel 两阶段**（阶段一已在 NAS 上跑通）：

1. **快速隧道** —— 不需要域名、不需要账号。在 `docker-compose.mount.yml` 里启用 `tunnel` 服务，
   `docker compose up -d` 后从日志里取地址：

   ```bash
   sudo docker logs game-wiki-tunnel 2>&1 | grep trycloudflare
   ```

   ⚠️ 该地址**每次重启都会变**，属于试用性质，别当正式服务依赖。
2. **命名隧道** —— 买了域名后：域名托管到 Cloudflare，用固定 token 连接，
   得到自己域名的固定地址 + 自动 HTTPS。

**安全红线**：隧道只指向 `http://web:80`（这一个站点），**绝不要把 NAS 管理界面暴露到公网**。

### 踩坑记录：NAS 拉不动镜像

现象：`docker compose up -d` 报 `Get "https://registry-1.docker.io/v2/": context deadline exceeded`。

原因：`/etc/docker/daemon.json` 里原来只配了 `docker.1ms.run` 一个加速器，
**它只代理 manifest，blob 仍指向被墙的 `registry-1.docker.io`**，所以镜像拉不下来。

解决：换成多个能代理 blob 的加速器，然后重启 docker：

```json
{
  "data-root": "/volume1/@docker",
  "features": { "containerd-snapshotter": false },
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1ms.run",
    "https://docker.1panel.live",
    "https://hub.rat.dev"
  ]
}
```

> 改前先备份原文件；**`data-root` 必须原样保留**，改了容器会「凭空消失」。
> 另外：重启 docker 守护进程会让**所有 `restart=always` 的容器自动复活**（哪怕你先前手动停过）——
> 这是 Docker 的既定行为，不是 bug。改完记得顺手把不用的容器策略改成 `no`。

### 方式 B（不推荐）：容器内构建

根目录的 `Dockerfile` + `docker-compose.yml` 是「容器内自行构建」版本，适合**本机已装 Docker**的机器。
NAS 上走这条要先装 git/npm，且 ARM 构建很慢。
