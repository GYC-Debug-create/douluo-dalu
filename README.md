# 斗罗大陆 · 武魂觉醒

这是一个以 Vue 3 重构界面、由 Express 提供存档 API 和生产静态资源的文字 RPG。旧版 `public/` 中的地图、图鉴、数据与兼容页面仍保留，供 Vue 应用复用。

## 环境要求

- Node.js `^20.19.0` 或 `>=22.12.0`
- npm（随 Node.js 安装）

## 生产方式启动

首次获取项目后执行：

```bash
npm ci
npm start
```

`npm ci` 会按两个 lockfile 安装根目录和 Vue 前端依赖。`npm start` 每次都会先重新构建 `frontend/dist`，成功后再启动 Express，因此不会依赖仓库中已有的旧构建产物。需要主动升级依赖时才使用 `npm install`。

启动完成后访问：

- 游戏入口：<http://localhost:3000>
- 健康检查：<http://localhost:3000/api/health>

端口可通过 `PORT` 环境变量覆盖。例如在 PowerShell 中：

```powershell
$env:PORT = 8080
npm start
```

## Vue 开发模式

开发时需要分别启动 API 服务与 Vite：

```bash
# 终端 1：Express API（默认 3000）
npm run dev

# 终端 2：Vite（默认 5173，并代理 /api 到 3000）
npm run dev:frontend
```

然后访问 <http://localhost:5173>。生产验收仍应使用 `npm start` 和 3000 端口，以验证实际构建与 Express 静态资源链路。

## 常用命令

```bash
npm run build          # 构建 Vue 到 frontend/dist
npm run validate:data  # 校验游戏数据
npm test               # 先构建 Vue，再运行 Node 测试
```

## 目录结构

```text
斗罗大陆/
├─ frontend/           # Vue 3 + Pinia + Vue Router 前端
│  ├─ src/
│  └─ dist/            # npm run build 生成，不作为源码
├─ public/             # 旧版兼容页面、地图、图鉴与静态数据
├─ data/               # Express 文件存档目录
├─ tests/              # Node 测试
├─ server.js           # Express API 与 Vue 生产入口
└─ package.json
```

## 服务行为

- `/` 与 `/index.html` 返回 `frontend/dist/index.html`（Vue 应用）。
- `/api/*` 继续由 Express 提供。
- `/data/*`、`/map.html`、`/codex.html` 以及其他旧 `public/` 资源继续可直接访问。
- 如果直接运行 `node server.js` 且 Vue 尚未构建，入口会返回 503 并提示先执行 `npm run build`；正常使用 `npm start` 不会遇到这一情况。
