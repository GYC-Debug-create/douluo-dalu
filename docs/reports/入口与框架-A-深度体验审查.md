# 入口与框架（板块 A）· 用户深度体验审查

> 复查日期：2026-08-03
>
> 审查对象（板块 A）：`game.html`（正式文字 RPG）／`index.html`（旧 Canvas 原型）／
> `server.js`／`map.html`／`codex.html`／双套 CSS（`css/style.css` + `css/text-combat.css`）。
>
> 立场：站在"第一次打开游戏、只看界面和入口、会相信存档和导航"的玩家视角，检查板块 A 的
> 可信度、一致性和可维护性。重点是**入口能否可靠地把玩家送到他们以为要去的地方**，
> **导航/存档/主题在几个页面之间是否守恒**。
>
> 本轮验证证据：
> - `npm test`：44/44 通过；`npm run validate:data`：通过（13 个 JSON、9 个魂环事件）。
> - 本地起服（PORT=31999）实测路由：`/`→game.html（135,994B）、`/index.html`→7702B、
>   `/game.html`→136.0KB、`/map.html`→37874B、`/codex.html`→65847B、
>   `/css/text-combat.css`→7783B、`/css/style.css`→19335B、`/api/spirits`、`/api/player/list`→200。
> - `git log` 与 `git status` 确认数据存档目录未被纳入版本控制（板块 A 不涉及提交）。

---

## 一、入口矩阵（现状）

| 玩家输入 | 服务器返回 | 进入的"产品" | 主题 | 存档体系 |
|---|---|---|---|---|
| `/` | `game.html`（server.js:109） | 文字 RPG（正式） | 羊皮纸金褐 | localStorage `dldl_text_rpg_save` + 备份链 + `/api/player/save` |
| `/game.html` | `game.html`（静态） | 同上 | 同上 | 同上 |
| `/index.html` | `index.html`（server.js:110 + 静态） | 旧 Canvas 像素原型 | 深紫暗色 | `/api/player/save`（**不读 gameMode**） |
| `/map.html` | `map.html`（静态） | 万象地图（独立/可被 iframe） | 羊皮纸 | 只读 `map-state` postMessage |
| `/codex.html` | `codex.html`（静态） | 万象图鉴（独立/可被 iframe） | 羊皮纸 | 只读 `fetch` JSON |
| `game.html#/map`、`#/codex` | 同上（SPA iframe 内嵌） | 地图/图鉴（共用顶部返回） | 同 | 经 askirame 通信 |

**结论**：入口本身是通的（今天的路由实测 200 全部正常），真正的板块 A 级问题在
"两边入口互相混在一起" 和 "样式、导航、存档其实各写了一遍"，而不是页面打不开。

---

## 二、问题清单

### A1. 新旧两套前端共用同一存档后端，格式不相认（P1｜已确认）

- **现象**：`index.html`（Canvas）和 `game.html`（文字 RPG）调用同一个 `/api/player/save`
  与 `/api/player/list`，头像的 `playerId` 前缀都是 `p_...`，结构相同。玩家在旧 Canvas 界面上
  点"读取存档"会看到文字 RPG 的存档，而 `js/main.js`/`ui.js` 读取该档时很可能把它当作
  Canvas 结构来用（`saveLocal` 写入了 `gameMode:'text-rpg'`，但 Canvas 端不校验，见
  game.js:1317）。
- **玩家感受**：在新入口辛苦玩的内容，到旧入口"读档"按钮里以完全无法打开的格式存在；
  两个入口一会认为这里没有档、一会读到不该出现的档，信任直接受损。
- **建议（建设性）**：
  1. 后端 `/api/player/list` 和 `/api/player/save` 增加 `gameMode` 字段，
     `list` 侧返回 `gameMode` 供前端各自过滤展示；
  2. 至少两个前端各按 `gameMode` 过滤存档列表——旧 Canvas 只显示 `canvas`，
     文字 RPG 只显示 `t`ext-rpg 的档；
  3. 若期望"两档互通"，需要给出明确的档格式迁移与解释，不要无提示共用一处文件。

### A2. iframe 通信不校验来源（P2·安全/可靠）
- 证据：game.html:2666 `window.addEventListener('message', …)` 只判断 `e.data.type`，
  既不看 `event.origin` 也不看 `event.source` 是否等于自己的 iframe；`map-travel` 能直接驱动父页导航。
  map.html/codex.html 的 `window.parent.postMessage(...)` 也没有 origin 检查。
- 风险：任何被嵌入的同页 iframe（或开发期的外链）都能冒名发送 `navigate/map-travel`。
- 建设性建议：写一个 `isTrustedChild(e)`（校验 `e.origin === location.origin && e.source 是本页 iframe`），
  在 game.html / map.html / codex.html 的消息入口统一套用，作为 iframe 通讯的"门卫"。

### A3. 页面主题其实不是"双套"，而是"四套 ~五套"（P1·维护性）
- `css/style.css`（Canvas，19.3KB）
- `css/text-combat.css`（真正的战斗界面壳，7.8KB）
- `game.html` 内联 `<style>`（约 1600 行，**实际上的主样式**，标题/创建/战斗/弹窗/响应式全在这）
- `map.html` 内联 `<style>`（羊皮纸，自己一套 `--gold/--ink/--line`）
- `codex.html` 内联 `<style>`（又一套羊皮纸 token）
- 三套 "羊皮纸" token 的数值已在漂移（例如 `--bg`：#1f1810 / #1a1408；`--line`：#4a3d22 / #3a2f1a）。
- **建设性建议**：
  1. 先把 `:root` 设计 token 抽出到一个 `tokens.css`（或加强 text-combat.css 承担），
     对 game/map/codex 三面共用同一套 `--` 变量；拆卡片和事件卡改在 SVG/内联，不再复制 token；
  2. 标记 `index.html` 为"旧版像素原型"，主菜单不再把"文字 RPG 模式"放第一层，避免两套主题反复跳跃；
  3. 逐步把 game.html 的 1600 行内联 CSS 移进 `css/text-combat.css`（或新建 `game-rpg.css`），
     届时可以收紧 CSP 里现在无必要保留的 `style-src 'unsafe-inline'`、`script-src 'unsafe-inline'`。

### A4. 存档链可靠但是"无提示重写"（P2）
- saveLocal 在每次存档都会整包重算 JSON 并轮转 `_backup / _hist1..4`（game.js:1314-1340），
  没有写体积监控；当存档膨胀超过 navigate 的 localStorage 上限时，`saveLocal()` 静默失败并只在兜底 catch 里 console。
- 建议：
  - 保存失败时把返回改成可反馈（false → 由调用方 toast "本地空间不足，建议导出/清理"）；
  - 对 `lastSave`/`saveServer` 成功与否明确排序 "当前有效版本在最前"（UX-025 已列，本次不展开）。

### A5. 入口健壮性：数据加载失败等于进入全场失败（P2·体验）
- `init()`（game.js:1107-1130）里 `loadData()` 失败只 `toast('数据加载失败，请刷新重试')` 后 return；
- 但上方 `recoverFromStorage` 仍会把 `G` 填上，首页"继续冒险"按钮还会出现——玩家以为自己有 Game，
  点继续却完全没有可动内容。这是"入口能过，世界没有"的空黑洞。
- 建议：失败时明确显示"缺少 [文件名]"与"重试"按钮；继续入口在加载失败时置为禁用态并标注原因。

### 其他（观察到，非本次 p0）
- `/index.html` 与 `/` 显式路由存在重复依赖，但结构 OK，只建议保留一条注释,不要双份 SSE；
- `map.html` 顶层页面在 iframe 内会隐藏 topbar 并由父级返回按钮接管——两个访问形态（独立/内嵌）
  的 "顶部返回"文案权重不同，靠 `getReturnTarget()` 统一维护（game.html:2517），这部分是好的；
- `data/player_*.json` 已被当前工作区之外并计入 restore，如后续考虑往标准部署走，
  server.js 可加速加 `/api/health` 和静态缓存头 `Cache-Control`。

---

## 三、按"建设性"排序的行动建议（可执行顺序）

| 序号 | 行动 | 等级 | 预计工作量 |
|---|---|---|---|
| 1 | 统一存档入口：`gameMode` 写入 + `list` 加字段 + 两端按 `gameMode` 过滤 | P1 | 小（server.js + 两个列表渲染） |
| 2 | 加固 iframe 通讯：`isTrustedMessage` 统一过滤 | P1 | 小 |
| 3 | 抽 `tokens.css`，四页面共用 token，消灭数值漂移 | P1 | 中 |
| 4 | `loadData` 失败给出名称 + 重试；"继续"在加载失败时禁用 | P2 | 小 |
| 5 | `index.html` 标记"旧版原型"，弱化主菜单地位 | P2 | 极小 |
| 6 | 存档失败可反馈；数据量监控提示 | P3 | 小 |
| 7 | 将来把 game.html 内联 CSS/JS 外置，开放更严的 CSP | P3 | 大（规划） |

## 四、给后续板块（B/C/D…）的一个校验钩子

建议把下列"三守恒"作为各板块复核的共性标准：
1. **入口守恒**：玩家看到的按钮和它实际去到的 URL/页面永远一致（含"返回"）。
2. **存档守恒**：任何界面显示的等级/魂环/地点/人，都必须来自同一个载入的数据。
3. **主题守恒**：同一产品内的样式 token、文案称谓、内部 ID→中文名映射保持一致。

所有声明均在本轮 server 实测与测试基线之上给出；如需任何一项的实用 SQL/代码示例可单独取出实现。