# 游戏科普网站

以**「游戏系列」为单位**的剧情 / 世界观科普百科站。

## 站点结构

```
系列（Series）
├── 系列主页 —— 作品卡片列表 + 底部世界观时间轴
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
  悬停弹出卡片，或跳转到词条详情页 / 游戏内文档条目

## 已规划系列

| 系列 | 作品 | 特色 | 状态 |
|------|------|------|------|
| 逃生 | 逃生1 / 告密者 / 逃生2 / 试炼 | 强化世界观时间轴 | ✅ 4 部作品已录入（52 个词条） |
| 尸体派对 | 系列各作 | 死法收集图鉴 | ⏳ 待开工 |

## 协作

- 远程仓库：Gitee（`sun-jiaheng123/data-website-project`）
- 开发工具：IntelliJ IDEA / Trae，通过 Git 同步
- 内容都在 `src/data/` 下的 JSON 里（系列 / 作品 / 词条 / 时间线），填数据即可扩展

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
