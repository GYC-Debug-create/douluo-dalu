# BUG-DIALOG-004 实施报告：武魂介绍完整展示与神级武魂独立详情

> 本报告记录 BUG-DIALOG-004（武魂介绍被限制为两三行、长详情需要内部滚动）的实施内容、验证过程与结论。
> 报告结论由 Codex 最终判定，本文不写入 ACCEPTED。

## 1. 修改文件清单

| 文件 | 操作 | 作用 |
|---|---|---|
| `frontend/src/pages/CreatePage.vue` | 修改 | 方案C神级武魂选择（列表→独立详情→确认选择）、方案B结果正文全文展示与分段、分段纯函数 `splitSpiritDescription` |
| `frontend/src/components/ModalDialog.vue` | 修改 | 新增显式可选宽版能力 `panelClass`（`is-wide` 时才放大），默认 520px 行为不变 |
| `frontend/tests/create-awakening-ui.test.js` | 修改 | 新增 BUG-DIALOG-004 单元测试 23 条（原有 87 条未改） |
| `frontend/browser-smoke.mjs` | 修改 | 追加独立 BUG-DIALOG-004 浏览器验收段；BUG-003 G3 仅交互路径适配（详见 12 节） |
| `docs/reports/BUG-DIALOG-004-实施报告.md` | 新增 | 本报告 |
| `docs/local/bug-dialog-004/` 下 4 张新截图 | 新增 | 见第 11 节 |

## 2. 方案C：神级武魂选择流程（独立武魂志）

- 神级弹窗仍展示 `data.value.spirits` 中全部 12 种神级武魂，未新增任何数据源、未复制武魂对象（列表与详情共用同一真实对象）。
- 列表卡保持紧凑：图标、名称、40 字预览（预览允许截短，仅作意图提示）、明确「查看详情 →」按钮。
- 点击卡片只调用 `openGodDetail(spirit)`：打开该武魂的独立详情视图；不调用 `pickGodSpirit`、不关闭弹窗、不清零保底、不改变背后觉醒结果。
- 独立详情视图（黑金风格，宽屏左图右文，`god-dossier`）：
  - 「← 返回神级武魂列表」按钮；
  - 武魂真实图片（`previewedGodSpirit.image`），无图片时用现有图标 `icon` 安全降级；
  - 「神级武魂」品质标识、武魂名称；
  - 完整、未经截断或改写的 desc（经分段函数做纯视觉分段）；
  - 「确认选择「武魂名」」按钮，点击后走既有 `pickGodSpirit` → `doAwaken(spirit)` 逻辑（关闭弹窗、生成结果、按 BUG-DIALOG-003 规则只清零当前出身保底）。
- 返回列表后焦点恢复到刚查看的卡片（`data-spirit-id` + `CSS.escape`）；打开详情后焦点进入返回按钮。
- 关闭弹窗（X 或确认）后 `watch(showGodPicker)` 重置视图为列表层；重新打开默认回到列表，不停留上次详情层。
- 宽版弹窗通过 `panel-class="is-wide"` 显式启用，ModalDialog 默认 `panelClass=''` 时仍为 `min(520px, 92vw)`，其他调用方（GamePage、GameFeatureModal）视觉完全不变。

## 3. 方案B：觉醒结果全文展示与分段规则

- 移除 `.awaken-desc` 的固定 `height:80px`、`max-height:80px`、`overflow-y:auto`，正文随内容自然增高，无需点击展开；不得使用抽屉、二次弹窗或折叠按钮。
- 结果面板带弱标题层级「武魂志 · 完整记载」，正文按段渲染 `<p class="awaken-desc-p">`，保持黑金风格；正文、属性、保底提示、操作按钮层级清晰，按钮不被正文覆盖。
- 分段纯函数 `splitSpiritDescription(desc)`（导出自 CreatePage.vue，可直接导入测试）：
  - 空值/null/undefined/纯空白 → `[]`；
  - `≤ SHORT_DESC_LIMIT(100)` 字 → 单段；
  - 长介绍在中文句号「。」、叹号「！」、问号「？」、分号「；」后、文本 25%～75% 区间内选择最接近中点的边界拆成两段；
  - 找不到可靠边界保持单段，绝不从词语中间强拆；
  - 不修改、不删除、不重写任何原始字符（含标点）：所有段落按顺序 `join('')` 严格等于原 desc 去除首尾空白后的结果。
- 创世之书 198 字拆为 2 段（75/123），邪眸白虎 201 字拆为 2 段（118/83），均为可读段落。
- 觉醒动画保留，动画结束后正文完整可读；390 窄屏允许整个创建页面自然纵向滚动，`.awaken-desc` 自身不滚动、无横向溢出。

## 4. 数据、抽取、属性、保底、存档未变

- 未修改 `public/data/spirit-codex.json` 及任何数据 JSON；未重写介绍、未补充世界观、未改名、未改标点。
- 未修改 `rollSpiritTier`、`pick`、品质分级、属性计算、先天魂力（`useGameRules.js` 零改动）。
- 未修改 BUG-DIALOG-003 保底草稿模型、计数、50 封顶、清零规则（`creation-pity.js` 零改动）。
- 未修改 `serializer.js`、创建草稿键、正式存档键、存档版本；无任何存档字段变化，旧存档无需迁移。
- 「查看详情」不产生任何业务状态变化；「确认选择」复用既有选中逻辑，未创建第二套选择流程。
- 刷新、重新觉醒、重新选择出身、确认角色行为与实施前一致。

## 5. 单元测试

`frontend/tests/create-awakening-ui.test.js` 新增 **23 条** BUG-DIALOG-004 测试（原有 87 条未改动），覆盖：

1. 长介绍（创世之书/邪眸白虎）分段后按顺序 join 严格等于原文；
2. 短介绍（水壶 68 字）保持单段；
3. 空值、null、undefined、纯空白安全返回 `[]`；
4. 分段不删除中文标点（逐字符计数比对）；
5. 创世之书 198 字完整保留并形成 1～2 段；
6. 结果模板不再对 `awakenedSpirit.desc` 执行 slice（源码级断言）；
7. 神级详情展示完整 `previewedGodSpirit.desc`（不截断）；
8. 卡片点击只进入预览（`@click="openGodDetail(spirit)"`），不直接调用 pickGodSpirit；
9. 只有确认按钮调用既有 `pickGodSpirit`；
10. `.awaken-desc` 不再存在固定 80px / max-height / overflow-y:auto（源码级断言）；
11. ModalDialog 宽版为显式可选（默认 520px 与默认参数不变）；
12. 无可靠边界保持单段、焦点恢复、返回按钮可访问名称等补充断言。
13. BUG-DIALOG-002/003 既有测试全部继续通过（`npm test` 全绿）。

## 6. 四条命令与退出码

在项目根目录依次执行：

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run validate:data` | 0 | 数据校验通过 |
| `npm run build` | 0 | Vite 构建成功（CreatePage 15.53 kB，ModalDialog 1.20 kB） |
| `npm test` | 0 | 根测试 `53/53` 通过；前端测试 `110/110` 通过（87 旧 + 23 新） |
| `npm run test:browser` | 0 | 完整浏览器烟测通过（BUG-001～004 全部断言） |

浏览器烟测中曾出现一次既有「签到」段 toast 汇总断言时序抖动（见第 14 节剩余风险），复跑后连续通过，与本次改动无关。

## 7. 五档视口浏览器结果

详情层（神级武魂独立详情，弹窗内）：

| 视口 | modal 宽度 | 正文 clientH/scrollH | 图片/按钮溢出 | 横向滚动 | 滚动策略 |
|---|---|---|---|---|---|
| 1920×1080 | 1100px | 145/145 | 无 | 无（1920/1920） | 双栏 |
| 1440×1000 | 1100px | 145/145 | 无 | 无 | 双栏 |
| 1024×768 | 963px | 199/199 | 无 | 无 | 双栏 |
| 768×900 | 722px | 334/334 | 无 | 无 | 双栏→窄屏堆叠 |
| 390×844 | 366.6px | 280/280 | 无 | 无（390/390） | 上下排列，仅 modal-body 纵向滚动（overflow-y:auto） |

结果页（邪眸白虎 201 字正文）：

| 视口 | 正文 clientH/scrollH | overflowY | 按钮可见 | 横向滚动 |
|---|---|---|---|---|
| 1920×1080 | 280/280 | visible | 是 | 无（1920/1920） |
| 1440×1000 | 280/280 | visible | 是 | 无 |
| 1024×768 | 280/280 | visible | 是 | 无 |
| 768×900 | 280/280 | visible | 是 | 无 |
| 390×844 | 400/400 | visible | 是 | 无（390/390） |

正文区、图片区、卡片区均未产生嵌套滚动；详情正文 `overflow-y: visible`。

## 8. 创世之书与最长介绍实测

| 项目 | 创世之书 | 邪眸白虎（当前最长） |
|---|---|---|
| desc 实际长度 | 198 字 | 201 字 |
| 分段结果 | 2 段（75/123） | 2 段（118/83） |
| 拼接后与原文 | 严格相等（trim 后） | 严格相等（trim 后） |
| clientHeight | 250px | 280px |
| scrollHeight | 250px | 280px |
| overflowY | `visible` | `visible` |
| 内部滚动 | 无（scrollHeight ≤ clientHeight + 1） | 无 |

实施前基线（任务描述确认）：创世之书正文 clientHeight=80、scrollHeight=204，玩家仅能直接看到约 39.2% 正文；实施后 250/250 全量可见。

## 9. 预览不触发选中和保底清零的证据

真实 Chrome（`test:browser` 阶段 C）：
- 预置草稿 `{ star_forest: 50, spirit_city: 7, ... }`，觉醒结果为非神级武魂 X；
- 打开神级弹窗 → 断言 12 张卡片；
- 点击「创世之书」卡片 → 断言：弹窗仍打开、已进入独立详情、详情介绍与 spirit-codex.json 原文严格相等（198 字）、背后觉醒结果仍为 X（非创世之书）、`.awaken-left` 仍显示「星斗小村神级保底：50 / 50」、草稿 `star_forest=50`、`spirit_city=7` 均未变化；
- 返回列表后弹窗仍打开、结果与保底仍未变化（阶段 F）；
- 关闭并重新打开弹窗 → 默认回到列表层（阶段 G）。

## 10. 确认后才选中并只清当前出身保底的证据

真实 Chrome（阶段 H）：
- 再次进入创世之书详情，点击「确认选择「创世之书」」→ 弹窗关闭、觉醒结果变为创世之书；
- `.awaken-left` 显示「星斗小村神级保底：0 / 50」且「其他出身：武魂城世家 7/50」保持不变；
- 草稿最终 `{ star_forest: 0, spirit_city: 7, border_town: 0, sea_island: 0 }`，仅当前出身清零；
- BUG-003 G3 断言（手动自选只清当前出身）继续通过。

## 11. 新截图

`docs/local/bug-dialog-004/`（新目录，绝不覆盖旧证据）：

- `bg004-c-1920-god-dossier.png`（300,710 字节）
- `bg004-c-390-god-dossier.png`（163,995 字节）
- `bg004-b-1920-result-full.png`（637,417 字节）
- `bg004-b-390-result-full.png`（252,312 字节）

截图前均满足：动画完成或渲染状态稳定（连续帧位置/透明度稳定）、完整正文已出现、元素 opacity ≥ 0.95、非零宽高、详情图片 `complete && naturalWidth > 0`。

## 12. BUG-001～003 旧截图保护证据

烟测前后对 `docs/local/bug-dialog-001`（5 张）、`bug-dialog-002`（9 张）、`bug-dialog-003`（6 张）共 **20 张**旧截图分别记录 SHA256、LastWriteTime、Length：

- 前后全部零变化（`checked 20 files, diffs: 0`）；
- 运行期间日志均为「截图已存在，跳过写入（只写一次保护）」；
- 唯一的断言层适配：BUG-003 G3 在「自选神级武魂」后追加点击「确认选择」按钮。原因：方案C 产品规则规定卡片点击只能打开详情、只有确认才选中；G3 的断言本身（自选后当前出身清零、其他出身不变、正式存档无保底字段）一字未改、强度未降。

## 13. 控制台与网络错误

- BUG-DIALOG-004 独立上下文收集的 `pageerror`、`console.error`、关键 `requestfailed`、HTTP ≥ 400 响应：**0 条**（`assert.deepEqual(bg004Errors, [])` 通过）。
- 主流程页面同样 0 运行时错误（最终 `assert.deepEqual(runtimeErrors, [])` 通过）。

## 14. 未完成项与剩余风险

1. 既有「签到（BUG-004）」段有一次 toast 汇总断言时序抖动（首轮复跑失败、后续连续通过），属既有测试对 toast 自动消失时机的敏感，非本次改动引入；本次改动未触碰 GamePage 与通知系统。若需根治需调整该段的 toast 采集时序，属范围外。
2. 本模型无法读取设计参考图，方案C/方案B 按任务内文字规则实施（左图右文、黑金、返回/确认、武魂志弱标题等）；与图片的像素级一致需人工目视比对四张新截图。
3. 分段阈值 `SHORT_DESC_LIMIT=100` 与 25%～75% 边界窗口为本次实现选择；未来若新增超长介绍（例如 > 400 字），当前规则仍为两段，需要时可扩展为多段，但必须保持 join 恒等于原文。
4. 详情/列表焦点恢复依赖 `CSS.escape`（Chrome 46+ 均支持），与项目浏览器支持面一致。
5. 神级弹窗宽版仅由 CreatePage 显式传入 `panel-class="is-wide"`；若未来其他调用方误传，需按显式配置复核。

---

# BUG-DIALOG-004-R2 修复章节：浏览器验收证据缺陷

## R2-1. Codex 发现的重复字段问题

`frontend/browser-smoke.mjs` 阶段 E 的 evaluate 返回对象中，`bodyScrollW` 被定义了两次：

1. `bodyScrollW: document.body.scrollWidth`（原本意图：页面宽度）
2. `bodyScrollW: body.scrollWidth`（modal-body 宽度，覆盖前者）

后一个键覆盖前一个键，导致：

- 「页面不得横向滚动」断言实际比较的是 **modal-body 的 scrollWidth 对文档 clientWidth**（`m.bodyScrollW <= m.clientWidth + 1`），两个对象都不是页面级宽度，页面真实横向宽度从未被检查；
- 「modal-body 内容不得横向溢出」断言（`m.bodyScrollW <= m.bodyClientW + 1`）恰好因覆盖后语义与字段名相符而“碰巧”正确，但页面级断言与 modal-body 级断言共用同一字段，无法区分层级，形成假阳性。

## R2-2. 修改后的字段名（全部唯一、语义明确）

阶段 E（详情层五档视口）evaluate 返回对象：

| 字段 | 含义 |
|---|---|
| `innerWidth` | `window.innerWidth`（视口生效校验） |
| `pageScrollW` | `Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)` —— 覆盖 html/body 的真实页面横向宽度 |
| `pageClientW` | `document.documentElement.clientWidth` |
| `modalWidth` | modal-box 的 `getBoundingClientRect().width` |
| `modalScrollW` / `modalClientW` | modal-box 的 `scrollWidth` / `clientWidth` |
| `modalBoxOverflowY` | modal-box 计算样式 `overflowY`（记录为 `hidden`，证明其不可能被当作滚动容器） |
| `modalBodyScrollW` / `modalBodyClientW` | modal-body 的 `scrollWidth` / `clientWidth` |
| `bodyOverflowY` | modal-body 计算样式 `overflowY` |
| `descOverflowY` / `descScrollH` / `descClientH` | 详情正文区 `.god-dossier-desc` |
| `imgInside` / `confirmInside` | 图片、确认按钮是否位于弹窗范围内 |
| `scrollChain` | 从 `.god-dossier-desc` 向上到 `.modal-box`（含）的每个祖先的 class、计算 `overflowY`、是否实际可滚动（`overflowY` 为 auto/scroll 且 `scrollHeight > clientHeight + 1`） |

阶段 K（结果页五档视口）：`bodyScrollW`/`clientWidth` 同样更名为 `pageScrollW`/`pageClientW`（同一 `Math.max` 定义），避免任何同名歧义。

断言层级（互不混淆）：

- 页面：`pageScrollW <= pageClientW + 1`；
- 弹窗：`modalScrollW <= modalClientW + 1`；
- modal-body：`modalBodyScrollW <= modalBodyClientW + 1`；
- 正文：`descScrollH <= descClientH + 1` 且 `descOverflowY === 'visible'`；
- 图片/按钮：`imgInside`、`confirmInside`。

## R2-3. 五档视口的真实宽度指标（R2 实测，修正后断言）

详情层（创世之书，阶段 E）：

| 视口 | pageScrollW/pageClientW | modalScrollW/modalClientW | modalBodyScrollW/modalBodyClientW | descScrollH/descClientH | modal-body overflowY |
|---|---|---|---|---|---|
| 1920×1080 | 1920/1920 | 1098/1098 | 1098/1098 | 145/145 | auto |
| 1440×1000 | 1440/1440 | 1098/1098 | 1098/1098 | 145/145 | auto |
| 1024×768 | 1024/1024 | 961/961 | 961/961 | 199/199 | auto |
| 768×900 | 768/768 | 720/720 | 720/720 | 334/334 | auto |
| 390×844 | 390/390 | 365/365 | 365/365 | 280/280 | auto |

- 页面、弹窗、modal-body 三个层级各自 `scrollWidth == clientWidth`（允许 +1 容差），**不存在任何横向溢出**；
- 图片、确认按钮在五档视口均位于弹窗范围内（`imgInside`、`confirmInside` 通过）；
- 详情正文 `descScrollH == descClientH`（五档全部 145/145、199/199、334/334、280/280），`overflow-y: visible`，无裁切、无内部滚动；
- 弹窗宽度：1920/1440 下实测 1098px（宽版 `min(1100px, 94vw)` 上限 1100，R2 实测较 R1 报告记录 1100px 相差约 2px，属运行环境渲染差异，方向与量级均不影响任何断言）；1024→961、768→720、390→365。

结果页（邪眸白虎 201 字，阶段 K）：

| 视口 | pageScrollW/pageClientW | descScrollH/descClientH | desc overflowY |
|---|---|---|---|
| 1920×1080 | 1920/1920 | 280/280 | visible |
| 1440×1000 | 1440/1440 | 280/280 | visible |
| 1024×768 | 1024/1024 | 280/280 | visible |
| 768×900 | 768/768 | 280/280 | visible |
| 390×844 | 390/390 | 400/400 | visible |

## R2-4. 窄屏（768×900、390×844）单层纵向滚动检查

实现方式：阶段 E 对 `vp.width <= 768` 的视口，从 `.god-dossier-desc` 起沿 `parentElement` 向上逐级扫描到 `.modal-box`（含）为止，对每个祖先记录计算样式 `overflowY`，并按「`overflowY` 为 auto/scroll **且** `scrollHeight > clientHeight + 1`」判定是否**实际可滚动**。扫描范围止于 `.modal-box`：其外层 body 存在 `overflow-x: hidden`（按规范使 `overflow-y` 计算为 auto），属于弹窗外的页面滚动上下文，不属于「详情内容内部」；而 `.modal-box` 自身计算样式为 `overflow: hidden`，无论内容多高都不可能被判定为滚动容器，规避了误判。

断言（两段式）：

1. 除 `modal-body` 外不得存在任何实际可纵向滚动容器（`desc` 及详情内部正文容器禁止独立滚动）；
2. 若存在实际纵向滚动，唯一滚动容器必须是 `modal-body`。

实测结果：

- 768×900：`scrollables = []` —— 正文完整展示、内容在弹窗内恰好放得下，modal-body 虽为 `overflow-y: auto` 但并未真正滚动，属于「无任何内部滚动」的合法状态；
- 390×844：`scrollables = ['modal-body']` —— 唯一实际纵向滚动祖先即 modal-body，`.god-dossier-desc`、`.god-dossier`、`.god-dossier-main`、`.god-dossier-body`、`.modal-box`（hidden）均非滚动容器；
- 两档均证明：详情内容内部不存在除 modal-body 外的嵌套滚动区，窄屏纵向滚动由 modal-body 单层承担。

## R2-5. 四条命令退出码与测试数量（顺序执行）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run validate:data` | 0 | 13 个 JSON 文件、9 个魂环事件校验通过（含 10 张 >1MB 大图告警，属既有告警非错误） |
| `npm run build` | 0 | vite build 成功，83 modules，产物正常生成 |
| `npm test` | 0 | 根 tests 53/53 通过；frontend vitest 8 文件 110/110 通过 |
| `npm run test:browser` | 0 | 全流程通过，BUG-DIALOG-004 阶段 E 修正后断言全部通过（首轮在 768 视口因「scrollables=[]」的合法状态触发过深严格断言，已按 R2-4 两段式修正，复跑退出码 0） |

## R2-6. 24 张截图保护证据

运行 `npm run test:browser` 前后，分别记录 `docs/local/bug-dialog-001/`（5）、`bug-dialog-002/`（9）、`bug-dialog-003/`（6）、`bug-dialog-004/`（4）共 **24 张**截图的完整路径、SHA256、Length、LastWriteTime（UTC ISO 字符串），对比结果：

- 内容变化：0
- 时间戳变化：0
- 新增：0
- 删除：0
- 运行日志全部为「截图已存在，跳过写入（只写一次保护）」，`screenshotOnce` 保护未触碰。

## R2-7. 实际修改文件

- `frontend/browser-smoke.mjs` —— 阶段 E/K 字段更名与断言修复、窄屏单层滚动扫描（详见 R2-2、R2-4）；
- `docs/reports/BUG-DIALOG-004-实施报告.md` —— 追加本 R2 章节。

未修改：`frontend/src/**`、`frontend/tests/**`、`public/**`、`frontend/public/**`、所有 JSON 数据、抽取/保底/属性/存档/创建流程、BUG-DIALOG-001～003 既有烟测步骤与断言、`docs/local/**` 全部截图、本对话BUG清单-武魂觉醒.md、memory/**、依赖与构建配置；未提交、未推送、未重构、未删除任何文件。

## R2-8. 真实产品横向溢出结论

修正断言并实测五档视口后：**未发现真实产品横向溢出**（页面、弹窗、modal-body 三层级 scrollWidth 均等于对应 clientWidth，详情正文无裁切、无内部滚动，窄屏单层滚动由 modal-body 唯一承担）。无需 Codex 重新决定生产代码修复范围，本轮不修改产品 UI。最终结论仍由 Codex 给出，本报告不写入 ACCEPTED。
