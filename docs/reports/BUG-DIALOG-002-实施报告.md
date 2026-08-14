# BUG-DIALOG-002 实施报告：武魂觉醒页问号视觉偏移、左右留白过大

> 实施者：本轮实现会话
> 日期：2026-08-05
> 方案：任务书确认的方案 B（SVG 问号居中 + 顶级/神级武魂双侧错峰轮播）
> 审查结论：本报告不写入 `ACCEPTED`，最终结论由 Codex 给出。

## 1. 实际修改文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `frontend/src/pages/CreatePage.vue` | 修改 | 本 BUG 唯一源码改动：SVG 问号、觉醒步宽屏类、双侧轮播（模板/逻辑/CSS） |
| `frontend/browser-smoke.mjs` | 修改 | 新增 BUG-DIALOG-002 独立验收段落（原有 BUG-DIALOG-001 段落未动） |
| `frontend/tests/create-awakening-ui.test.js` | 新增 | 素材池纯函数单测（7 项），不修改任何既有测试文件 |
| `docs/local/bug-dialog-002/*.png` | 新增 | 7 张浏览器验收截图（见第 12 节） |
| `docs/reports/BUG-DIALOG-002-实施报告.md` | 新增 | 本报告 |

## 2. 每个文件的修改目的

- **CreatePage.vue**：实现方案 B 的全部产品规则 —— 仅觉醒步骤宽屏、SVG 问号、双侧轮播、单一计时器、reduced-motion 支持。`doAwaken()` 的抽取/保底/属性/存档逻辑一行未改。
- **browser-smoke.mjs**：在既有 BUG-DIALOG-001 验收之后追加独立段落，覆盖任务书第七节列出的全部浏览器验收点；BUG-DIALOG-001 段落未做任何修改，输出与实施前完全一致（1920px 85.4%、1440px 84.3%）。
- **create-awakening-ui.test.js**：对从 SFC 普通 `<script>` 块导出的纯函数（`buildCarouselPool` / `carouselOffset` / `carouselSlots`）做数据驱动测试，验证"不硬编码六张、全池可进入、不修改原数组、安全降级、左右不重叠"。

## 3. 最终素材池生成规则

```js
buildCarouselPool(spirits) = spirits.filter(s => s.tier === 'top' || s.tier === 'god') && s.image 非空字符串
```

- 素材来源：已加载的 `data.value.spirits`（useGameData 只读数据），非硬编码。
- 只含 `top` / `god` 且有有效 `image` 字段的武魂；按数据稳定顺序保留（不改写原数组，不 shuffle）。
- 数据增减时自动适配；素材池只做视觉展示，不参与 `doAwaken()` 抽取，不调用 `rollSpiritTier()`。
- 左右偏移：`carouselOffset(N) = floor(N/2)`（N≥6），保证左右 3 槽窗口在交替推进（相对位移仅在 off 与 off±1 间摆动）时永不相交。

## 4. 当前素材池实际数量及 tier 分布

- 总武魂 70 个；`top` 16、`god` 12。
- 素材池 = **28 个**（16 top + 12 god），全部具有 `image` 且文件存在于 `public/assets/spirits/`（已脚本核验 0 缺失）。

## 5. 同时渲染的图片数量

- DOM 中最多同时渲染 **6 张可见图**（左右各 3 槽：上方过渡、中央主图、下方过渡）。
- 轮播切换采用 Vue `<Transition>`（key=spirit.id）做 0.8s 交叉淡入淡出，过渡期间瞬态 DOM 中会短暂存在离场图副本，不产生新网络请求（同一 URL）。
- 不存在隐藏的 28 张 `<img>` 列表，不使用 `display:none` 预加载列表。

## 6. 预加载策略

- `preloadNextFor(side)`：每侧下一张进入图 = `pool[(start + 3) % N]`，通过单个 `new Image()` 加载，URL 去重（`Set`），绝不遍历全池。
- 初始进入觉醒步：6 张可见 + 左右各 1 张下一张 = **8 个请求**（浏览器烟测实测新增请求数 8，断言区间 [6, 8] 通过）。
- 推进时只补预载推进那一侧的下一张；整个会话累计请求远低于 28（烟测全流程含两次觉醒结果与重新进入，总数 18，且断言 `< 28` 通过）。
- 图片加载失败：沿用既有 `onImgError`（`display:none` 隐藏该装饰图），槽位随下次推进换新元素自动恢复，不影响中央觉醒流程。

## 7. 轮换间隔和左右错峰方式

- 单一 `setInterval`，间隔 **2200ms**（区间 2.1~2.5s 内）。
- 每次 tick 用 `carouselTurn % 2` 交替推进左/右一侧（窗口 start+1 mod N），故**每侧约 4.4s 推进一次**（区间 4.2~5s 内），左右永远错峰，同一时刻至多一侧在切换。
- 切换动画：`cshift` 过渡，0.8s 缓动，新图从 `translateY(14px) scale(0.94)` 淡入、旧图淡出上移；无快速翻牌、闪烁、旋转。

## 8. 计时器创建、停止和卸载清理方式

- 全局唯一 `carouselTimer`；`startCarousel()` 幂等（`timer !== null` 直接返回，杜绝叠加）；`stopCarousel()` 清空并置 null。
- `watch([step, spiritRevealed, carouselPool])`：仅 `step === 3 && !spiritRevealed && 池非空` 时启动，否则停止 —— 覆盖：
  - 首次进入觉醒步 / 数据加载完成时启动；
  - `spiritRevealed === true`（真实结果出现，650ms 揭晓动画后）立即停止；
  - 点击重新觉醒（`spiritRevealed` 回到 false）恢复——仍只恢复一套；
  - 离开觉醒步（重新选择出身 / 返回 / 跳转）停止；
  - 重复进入、重复觉醒、重新选择出身均不会叠加（幂等 + 单实例）。
- `onBeforeUnmount(stopCarousel)`：组件卸载清理。

## 9. 问号 SVG 的居中实现和测量结果

- 原 `？` 文本字符（回退字体字形偏移）替换为内联 SVG：
  - `viewBox="0 0 100 130"`，主体 `<path>` 描边 9（圆头），圆点 `<circle>`（cy=106, r=6.5）包含在 SVG 内；
  - `<g transform="translate(-5 6)">` 按几何计算把可见图形 bbox 中心精确对准 viewBox 中心 (50, 65)（含描边计算：path x∈[34.5,75.5]→平移后 [29.5,70.5]，dot 与 path 并集 y∈[17.5,112.5]）；
  - 金色沿用 `currentColor = var(--gold-dim)`，光晕用 `drop-shadow`，呼吸动画（透明度/模糊/scale）施加在稳定居中的 `.awaken-q` 包装层上，不产生左右漂移；
  - 已删除原文本专用补偿 `padding-bottom: 0.06em`、`font-size`/`font-family`。
- 测量（Chrome 真实 `getBBox()` + 视口换算）：
  - 1920×1080：SVG 可见图形中心与圆盘中心误差 **0.00px**；
  - 1440×1000：误差 **0.00px**（断言阈值 2px）。

## 10. 各视口测量结果

| 视口 | 圆盘中心 vs 视口中心 | SVG 图形中心 vs 圆盘 | 两侧轮播 | 横向滚动 |
|---|---|---|---|---|
| 1920×1080 | 0.00px | 0.00px | 可见，各 3 槽 | scrollWidth 1920 = clientWidth |
| 1440×1000 | 0.00px | 0.00px | 可见，各 3 槽 | scrollWidth 1440 = clientWidth |
| 1024×768 | ≤2px | — | 隐藏（<1200px） | scrollWidth 1024 = clientWidth |
| 768×900 | ≤2px | — | 隐藏 | scrollWidth 768 = clientWidth |
| 390×844 | ≤2px | — | 隐藏 | scrollWidth 390 = clientWidth |

尺寸规则：≥1400px 主图 clamp(210,15vw,235)px、过渡图 clamp(95,7vw,125)px；1200~1399px 主图 clamp(150,13vw,175)px、过渡图 clamp(80,7vw,100)px；<1200px 完全隐藏，保留原中央体验。

## 11. 自动化测试命令、退出码和测试数量

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run validate:data` | 0 | 通过 |
| `npm run build` | 0 | 构建成功（CreatePage chunk 正常产出） |
| `npm test` | 0 | 根测试 **53/53** 通过 + 前端 vitest **52/52** 通过（实施前 45，新增 7） |
| `npm run test:browser` | 0 | 完整浏览器烟测通过（含 build） |

前端新增单测（`create-awakening-ui.test.js`，7 项）覆盖：池过滤规则与顺序、全池可进入、不修改原数组、3 槽环绕、不足六张降级（空池/单张/5 张/非法入参均不抛错）、左右窗口不重叠、当前数量 16+12。

浏览器烟测新增断言覆盖（全部 PASS）：进入第三步；1920/1440 双组可见且每侧恰好 3 槽；全部素材 tier ∈ {top, god}；`pointer-events: none` 不可点击；圆盘与视口中心 ≤2px；SVG getBBox 中心与圆盘 ≤2px；一个轮换周期后仅一侧变化、再一周期另一侧变化、交替轮换；开始觉醒后轮播停止且两侧淡出至 0.2；重新觉醒后再次停止（无叠加）；重新进入觉醒步后单套节奏恢复；1024/768/390 隐藏且无横向滚动；初始图片请求 ≈6+2 且总量 <28；reduced-motion 上下文 5.2s 零变化；全程控制台无 error、无未处理异常；BUG-DIALOG-001 全部既有断言零回归（布局输出与实施前一致）。

## 12. 浏览器截图的完整路径

全部保存于 `docs/local/bug-dialog-002/`：

1. `bg002-1920-carousel.png` —— 1920px 觉醒前轮播
2. `bg002-1440-carousel.png` —— 1440px 觉醒前轮播
3. `bg002-1920-after-rotate.png` —— 1920px 轮换后（已交替推进）
4. `bg002-1920-revealed.png` —— 1920px 真实觉醒结果出现后（两侧淡出）
5. `bg002-1024-hidden.png` —— 1024px 两侧隐藏
6. `bg002-390-mobile.png` —— 390px 移动端
7. `bg002-1920-reduced-motion.png` —— prefers-reduced-motion 静态模式

## 13. 真实游玩验收结果

在真实 Chrome（`C:\Program Files\Google\Chrome\Application\chrome.exe`，headless）中完成两次完整创建流程：

- 流程 A（既有烟测主流程，回归）：建角 → 觉醒 → 确认进入游戏 → 剧情 → 商店 → 地图旅行 → 图鉴 → 继续冒险 → 签到 —— 全部通过，验证本 BUG 未破坏既有创建/游玩链路。
- 流程 B（本 BUG 流程）：建角 → 觉醒步各视口验收 → 轮换观察 → 真实觉醒 → 重新觉醒 → 重新选择出身 → 再次觉醒 —— 全部通过。
- 流程 C（reduced-motion 独立上下文）：静态组合、计时器不启动 —— 通过。

人工观察记录（基于量化测量与截图，供人工复核）：

- 左右错峰：断言"一个 2.6s 窗口内恰好一侧变化"连续两轮通过，无齐变；
- 主图/过渡图层次：主图 opacity 0.62、过渡图 0.22，尺寸递减，黑金细边框 + 暗角 + 少量金色辉光（0.12 alpha），无大面积发光；
- 中央结果仍为第一视觉焦点：轮播 z-index 0 低于圆盘 z-index 3，结果出现后两侧降至 0.2；
- 无闪烁/跳位/撑开：切换为交叉淡入淡出（0.8s），图片预加载后不出现突然撑开；各视口 `scrollWidth == clientWidth` 证明无横向溢出；
- 轮换速度：每侧 4.4s 一次，0.8s 过渡 + 1.4s 静止，节奏舒适；
- 重新觉醒无加速：重新觉醒后 5s 稳定零变化，证明未叠加计时器；
- 问号视觉居中：SVG 图形中心与圆盘中心误差 0.00px（getBBox 实测）；
- 两侧不会被误认为可点击：`pointer-events: none`、无 hover 效果、无箭头/分页点/选中框，图片 alt 为空、容器 aria-hidden。

## 14. 控制台和网络错误情况

- 全程 `runtimeErrors` 断言通过：0 条 console error、0 条 pageerror、0 条 document/script/stylesheet/xhr/fetch 请求失败或 ≥400 响应。
- 图片 404：素材池 28 张文件全部存在（脚本核验），无裂图。
- 网络请求量：初始觉醒页 8 张武魂图（6 可见 + 2 预加载）；含两次觉醒结果与重新进入步骤后累计 18 个请求（服务端未设缓存头，重新进入后同 URL 重新请求属预期），远低于全池 28。

## 15. 未完成项和剩余风险

- **人工目视复核**：本实施会话的模型不支持图像输入，无法直接目视截图像素；截图已按验收清单保存，需 Codex/人工打开 `docs/local/bug-dialog-002/` 复核观感（问号字形美感、金色层次、轮播节奏）。
- 素材池为 6 张以下时的降级（理论上：左右显示可能重复或仅 1 槽）未在真实数据下发生（当前 28 张），仅由单测覆盖"不抛错"。
- 轮播顺序不写存档（按任务书要求）；刷新页面后从池首重新开始。
- `dist/` 随任务书要求的 build/smoke 命令重新生成，未提交、未手工修改。

## 16. 实施前后差异说明

| 维度 | 实施前 | 实施后 |
|---|---|---|
| 中央问号 | 文本 `？`（字体字形偏左偏上，需 `padding-bottom: 0.06em` 补偿） | 内联 SVG（固定 viewBox，图形 bbox 精确居中，误差 0.00px） |
| 觉醒步容器 | `min(860px, 96vw)`（姓名/出身/觉醒共用） | 觉醒步 `min(1500px, 98vw)`（仅 `step===3` 的 `.is-awaken-step`），姓名/出身不变 |
| 左右空间 | 大面积空白 | 双侧 3 槽（主图+上下过渡）黑金边框轮播，28 张顶级/神级素材错峰循环 |
| 图片加载 | 觉醒后仅加载结果 1 张 | 初始 6 可见 + 2 预加载（受控），全流程 <28 |
| 轮换计时 | 无 | 单一 2200ms setInterval，左右交替，每侧 4.4s；reveal 停止 + 两侧淡出至 0.2；重觉醒/重进入不叠加；卸载清理 |
| reduced-motion | 无支持 | 不启动计时器、静态初始组合、关闭轮播与呼吸动画 |
| 抽取/保底/属性/存档 | — | 零改动（`doAwaken`、`rollSpiritTier`、保底计数、先天魂力、localStorage 字段均未触碰） |
| 可点击性/可访问性 | — | 轮播 `pointer-events: none`、`aria-hidden`、空 alt，纯装饰 |

---

# R2 修复记录（第二轮审查 CHANGES_REQUESTED 后的修复）

## R2-1. R1 审查发现的两个问题（原样转述，均已复现并修复）

1. **prefers-reduced-motion 下左右三张武魂完全重复**：真实 Chrome 中左侧为 昊天锤、七杀剑、蓝电霸王龙，右侧相同（同为 昊天锤、七杀剑、蓝电霸王龙）。根因：`startCarousel()` 在设置 `carouselRightStart` 半池偏移之前，因 `prefersReducedMotion()` 提前 return，右侧从未被设置到 `carouselOffset(pool.length)`，左右同从 0 开始。
2. **长时间轮换后重新进入觉醒步骤，左右窗口重叠**：真实 Chrome 复现左 火凤凰、冰凤凰、裂地龙 / 右 冰凤凰、裂地龙、海神三叉戟。根因：重新启动时只执行 `carouselRightStart.value = carouselOffset(pool.length)`（固定为 14），而 `carouselLeftStart` 保留之前累积的位置（例如 13），当左侧落在 12~16 区间时右窗 [14,15,16] 与左窗相交。

## R2-2. 原报告"永不相交"结论为什么不成立

R1 报告的"左右窗口交替推进时永不相交"只在**计时器自初始启动后连续运行**的前提下成立：连续推进时左右相对距离恒为 `off`，自然不相交。但该结论隐含了两条未成立的假设：

- 每次**启动/恢复**时右侧都重新对回到绝对位置 `off`（=14），而左侧不重新对齐 —— 只要左侧保留过旧值（长时间轮换后必然非 0），"右=固定 14"就会破坏相对距离，窗口相交（失败 2）；
- **reduced-motion 路径不经过对齐**就提前返回 —— 右侧从未离开 0，左右同窗（失败 1）。

即：R1 只验证了"连续运行中"的不相交，没有覆盖"跨启动边界"（重新进入、重新觉醒、reduced-motion 首次渲染）的不相交，结论范围写得太宽。R2 把对齐收敛到一个纯函数，并在每次启动/恢复时先对齐，使"永不相交"在任意 leftStart 下均成立（单测遍历 0~27 全部位置验证）。

## R2-3. 修复后的起始位置公式

新增纯函数（`CreatePage.vue` 普通 `<script>` 块导出）：

```js
alignedCarouselStarts(poolSize, leftStart)
  n = 非负整数 ? poolSize : 0
  n === 0 时 → { left: 0, right: 0 }            // 空池安全降级
  left = ((leftStart 规范化取整后) % n + n) % n  // 负数/超范围归一
  right = (left + carouselOffset(n)) % n        // carouselOffset(n) = floor(n/2)（n≥6）
  → { left, right }
```

`startCarousel()` 的执行顺序修正为：**先取素材池 → 先对齐 left/right（基于当前 left 旧值）→ 再判断 reduced-motion → 正常模式创建唯一计时器**。reduced-motion 下不创建计时器，但左右在渲染前已完成对齐，静态显示不同组合；正常模式保持 2200ms 左右交替、每侧 3 槽、错峰推进不变。当前 28 张数据下，left 位于 0~27 任意位置时左右 3 槽交集恒为 0。

## R2-4. 新增测试

单元测试（`create-awakening-ui.test.js`，新增 4 项，总计 11 项）：

1. reduced-motion 初始对齐位置：`alignedCarouselStarts(28, 0)` → `{ left: 0, right: 14 }`；
2. 遍历素材池全部 leftStart（0~27）：right 按 `(left + 14) % 28` 计算，左右 3 槽交集恒为 0；
3. 覆盖 R1 失败位置 `leftStart = 13`：left=13（槽 13/14/15），right=27 而非固定 14，交集为 0；
4. 负数（-1→27）、超范围（29→1、100→16）、null、空池（0）、非法数量（-1、1.5）安全降级，确定性输出（重复调用结果一致）、不抛错。

浏览器测试（`browser-smoke.mjs` BUG-DIALOG-002 段落扩充）：

- reduced-motion：等待静态稳定后断言左右各 3 槽、**6 个 ID 全部不同**、**左右交集 0**，等待 5.2s 后仍不变；
- 正常模式**初始、每次轮换后（s1/s2/s3）、觉醒结果后、重新觉醒后、重新进入后（初始/轮换一/轮换二）**均断言当前左右槽位交集为 0；
- 保留原有错峰（每 2.6s 窗口恰一侧变化且交替）、结果淡出至 0.12~0.32、窄屏隐藏、图片请求 6+2 且总量 <28、零控制台错误断言；
- 未添加任何可修改生产状态的调试接口，全部通过现有 UI 与 DOM 读取完成。

## R2-5. reduced-motion 左右六个实际 ID（真实 Chrome 实测）

```
左：昊天锤、七杀剑、蓝电霸王龙     （池索引 0、1、2）
右：冰凤凰、裂地龙、海神三叉戟     （池索引 14、15、16 = 0 + floor(28/2)）
交集：0；六个 ID 互不相同
```

## R2-6. 重新进入后的左右 ID 和交集（真实 Chrome 实测，长时间轮换后）

```
左：七宝琉璃塔、幽冥灵猫、邪火凤凰 （池索引 3、4、5 = 长时间轮换后的 left 旧值）
右：天使神剑、修罗神剑、九宝琉璃塔 （池索引 17、18、19 = (3 + 14) % 28）
交集：0
```

R2 修复后右窗严格由 `(left + 14) % 28` 得出；修复前（右固定 14）该场景会得到左 [3,4,5] / 右 [14,15,16] 不重叠但若 left 落在 12~16 区间则必然相交（即 R1 失败 2 的重现场景）。

## R2-7. 新截图路径（r2 后缀，未覆盖/删除 R1 原截图）

- `docs/local/bug-dialog-002/bg002-r2-1920-reduced-motion.png`（1920px reduced-motion 静态双组）
- `docs/local/bug-dialog-002/bg002-r2-1920-reentry.png`（1920px 长时间轮换后重新进入觉醒步骤）

R1 的 7 张原截图（`bg002-1920-carousel.png` 等）原样保留。R2 验收覆盖的 6 个场景：1920×1080 正常轮换、1920×1080 reduced-motion、轮换后返回出身并重新进入、重新觉醒、1440×1000、390×844 —— 全部由 `npm run test:browser` 覆盖通过。

## R2-8. 完整测试结果（R2 全部重跑）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run validate:data` | 0 | 通过 |
| `npm run build` | 0 | 构建成功 |
| `npm test` | 0 | 根 node 测试 **53/53** + 前端 vitest **56/56**（R1 的 52 + 新增 4） |
| `npm run test:browser` | 0 | 完整浏览器烟测通过（含构建） |

浏览器烟测关键实测数值：1920 圆盘中心误差 **0.00px**、SVG 问号中心误差 **0.00px**；1440 同为 **0.00px**；1024/768/390 无横向滚动（scrollW==clientW）且轮播隐藏；武魂图请求累计 **20**（初始 8 + 两次觉醒结果 + 重新进入 + reduced-motion 上下文新页 8），仍远小于全池 28；控制台零错误；BUG-DIALOG-001 布局输出与 R1 完全一致（1920px 85.4%、1440px 84.3%），零回归。

## R2-9. 关于 `memory/2026-08-05.md` 的说明

父目录（`D:\GYC\project\memory\`）在 R1 会话中曾创建 `2026-08-05.md` 作为会话运行日志，该文件不属于游戏代码修改范围。本轮 R2 未继续修改、未删除该文件，游戏代码改动仅限允许范围（CreatePage.vue、create-awakening-ui.test.js、browser-smoke.mjs、本报告、docs/local/bug-dialog-002/ 下 r2 截图）。

最终结论仍由 Codex 审查后给出。
