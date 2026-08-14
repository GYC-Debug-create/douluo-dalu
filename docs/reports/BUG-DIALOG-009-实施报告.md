# BUG-DIALOG-009 实施与审查报告

## 1. 产品结论

采用“传闻账本 + 条件进度 + 明确下一步”的非剧透引导：玩家能知道该去哪里、提升到什么阶段或补足哪类经历，但页面不展示 `_stormAdventure`、`_bossKilled` 等内部键，也不自动揭露秘境。所有秘境仍只在一次真实地图旅行完成后按原条件判定。

事件选项中的函数条件另作同原则收口：四个真实函数型选项分别显示等级或金币要求，不再统一显示“满足特殊条件”。

## 2. 已确认源码事实

- Vue 地图桥中已有六个隐藏地点及完整 `canReveal` 判定，但判定只在 `performMapTravel()` 中运行，地图从未把未满足条件和下一步发给玩家。
- 旧版 `public/game.js` 虽保存过六条传闻文本，当前 Vue 主流程与地图 iframe 没有呈现这些帮助内容。
- `SceneArea.vue` 对所有函数型 `req/cond` 固定返回“满足特殊条件”。当前实际事件数据中共有四个此类选项，门槛分别是 Lv.5、5000 金币、Lv.10、Lv.8。

## 3. 实现方案

- 六个秘境各自补充玩家语言的传闻和结构化要求；`canReveal` 原条件、数值和旅行触发点保持不变。
- 新增纯函数 `buildHiddenLocationClues()`，输出发现状态、每项进度、状态标签和唯一下一步；返回对象不含内部动态键。
- `buildMapState()` 将线索账本同步给地图 iframe。
- 地图新增“秘境传闻 0/6”入口和左侧独立面板；桌面与 390px 移动端均可滚动查看六条线索，地点详情面板与传闻面板互斥打开，Esc 可关闭。
- 函数型事件选项使用显式 `requirementHint`；若未来遗漏文案，降级提示为“留意事件描述中的条件线索”，不再伪装成可理解信息。
- 不新增存档键，不改变地点发现、随机旅行、天气、关系、等级或最终威胁规则。

## 4. 修改文件

- `frontend/src/utils/mapBridge.js`
- `frontend/src/components/SceneArea.vue`
- `frontend/src/data/game-data.js`
- `public/map.html`
- `frontend/tests/hidden-clues.test.js`（新增）
- `frontend/browser-smoke.mjs`
- `docs/local/bug-dialog-009/`（3 张新增截图）

## 5. 自动化测试

- `npm run validate:data`：退出码 0，13 个 JSON、9 个魂环事件通过。
- `npm run build`：退出码 0，Vite 83 个模块构建通过。
- `npm test`：退出码 0，根测试 58/58，前端测试 138/138。
- `npm run test:browser`：退出码 0，完整创建、觉醒、事件、商店、存档、地图旅行及 BUG-001～009 回归链通过。
- BUG-009 新增 5 项单测：六条传闻与内部键隔离；Lv.15+外围足迹；羁绊与暴风雨门槛；已发现状态；全部四个函数型事件选项具有明确文案。

## 6. 浏览器与实际效果

- 1440×1000：真实进入 Vue 地图，打开传闻面板；显示 6 个秘境、当前进度和下一步，地图仍可作为背景保持空间语境。
- 390×844：面板宽度不超过视口，页面和面板均无横向溢出；`.rumor-list` 为面板唯一纵向滚动区。
- 浏览器断言确认页面文本不存在内部键名；关闭面板后仍可继续选择相邻地点并完成原 BUG-007 的真实旅行。
- 改前事实图：`C:/Temp/codex-clipboard-11d59979-5f02-48b6-a5ff-9402fb6405cd.png`（事件只显示“需要满足特殊条件”）。
- 地图改前对照：`docs/local/bug-dialog-007/bg007-after-1440-fast-route.png`（已有目的地价值，但没有秘境线索入口）。
- 改后桌面最终图：`docs/local/bug-dialog-009/bg009-after-1440-hidden-clue-ledger-open.png`。
- 改后移动端图：`docs/local/bug-dialog-009/bg009-after-390-hidden-clue-ledger.png`。
- `bg009-after-1440-hidden-clue-ledger.png` 截于滑入动画起点，按只写一次证据规则保留，不作为最终观感图。

## 7. 审查结论与剩余风险

- 代码范围与 BUG-009 一致；未修改隐藏条件数值、存档结构或其他 BUG 的产品规则。
- 玩家现在能把“缺什么”转化为可执行行动，但地图旅行结束后的剧情分支丰富度仍取决于现有事件池；本 BUG 不扩写世界观剧情。
- 实际桌面与移动端截图已经人工目视，文字层级、可读性和地图遮挡范围可接受。
- 唯一清单在本轮验收通过后记录 `ACCEPTED`；本报告不预写状态词作为自我批准。
