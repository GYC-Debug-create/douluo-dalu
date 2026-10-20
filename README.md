# 斗罗大陆 · 武魂觉醒

这是一个以 Vue 3 重构界面、由 Express 提供存档 API 和生产静态资源的文字 RPG。旧版 `public/` 中的地图、图鉴、数据与兼容页面仍保留，供 Vue 应用复用。

## 作品体验与数值说明

- 游客可直接创建角色游玩，进度保存在当前浏览器；账号登录用于云端同步。
- 首页提供「全生命周期数值分析」，也可在游戏地址后加 `#/design` 直接访问。
- 说明页将可点击流程图与13个分析模块合并：觉醒、成长主线、内容投放、地图时间、战斗、九环、资源、技能挑战、伙伴、终局、保存覆盖、运行样本及修复证据。每部分说明输入输出、公式、取舍、例子、边界与来源，并可导出完整 CSV。
- 图表引用当前配置与共用规则；运行样本使用真实图鉴、Pinia、地图与战斗入口，从正常创建走至九环、15段主线及结局。样本是固定策略/种子的合成数据，不代表真实玩家胜率、时长、留存或付费表现。
- 本轮修复经验丹在等级上限处套利、影分身未生效、旅行天数与世界时钟不一致、第六环淬炼重复发奖，以及非战斗魂环吸收失败仍发成功奖励。展示页与实际玩法共用购买、时间和伙伴关系规则。

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

## 账号与存档归属

- 内测账号由管理员分配，默认不开放注册（仅设置 `ALLOW_REGISTER=1` 时开放接口）；账号 2-20 位字母/数字/中文，新密码 6-128 位。登录后可**修改密码**（`POST /api/auth/password`，验证原密码）。
- 每个账号拥有独立存档：`/api/player/*` 读写接口都要求登录（`x-auth-token` 头），且只能操作本人名下的存档。
- 密码以 scrypt 哈希存储在 `data/accounts.json`；Token 为无状态 HMAC（30 天有效），密钥持久化在 `data/.token-secret`，服务器重启不掉线（可用 `TOKEN_SECRET` 环境变量覆盖，需 ≥16 字符）。
- 管理员可用脚本建号/重置密码：
  ```bash
  node scripts/account-admin.js create <用户名> <密码>
  node scripts/account-admin.js set-password <用户名> <新密码>
  ```
- 账号体系上线前的旧存档可用迁移工具归属/归档：
  ```bash
  node scripts/migrate-legacy-saves.js list                        # 查看全部存档及归属
  node scripts/migrate-legacy-saves.js assign <用户名> <playerId...> # 归属给账号
  node scripts/migrate-legacy-saves.js remove <playerId...>         # 归档到 data/removed/
  ```

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
- `/data/*`、`/assets/*` 继续直接访问;旧轨整套已归拢至 `/legacy/*`(game.html/map.html/codex.html 等),仍可正常打开。
- 如果直接运行 `node server.js` 且 Vue 尚未构建，入口会返回 503 并提示先执行 `npm run build`；正常使用 `npm start` 不会遇到这一情况。

---

## 仓库说明

- 本仓库是团队共同开发项目（斗罗大陆 · 武魂觉醒）的公开副本。
- 提交者邮箱已匿名化；如需完整开发记录请联系团队成员。
- 仓库中的数据与测试夹具（如剧情数据、示例账号）均为开发用的示例内容，不包含真实凭据；运行前请按 `deploy/` 与 `docker-compose.production.yml` 的说明自行配置环境变量。
