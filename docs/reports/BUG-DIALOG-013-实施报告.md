# BUG-DIALOG-013 实施与审查报告

## 审查结论

`ACCEPTED`（2026-08-06）。玩家现在可以在第一魂环候选中看到自己对目标魂兽的既有了解，并在状态栏展开“猎魂简记”，查看独立猎魂历练、逐种魂兽了解度、最高实战年限、战绩与最近记录。该信息来自实际角色存档，不是静态魂兽图鉴。

## 事实、解释与产品决定

- 用户已确认事实：猎环/猎杀魂兽后，玩家看不到相关经验、了解度和过去记录。
- 源码事实：原流程只保存魂环上的 `beastId`，没有玩家维度的猎魂进度集合；静态魂兽录不能表示当前角色经历。
- 名词解释：“艺术经验”结合猎环上下文按“猎魂经验”处理，玩家文案统一为“猎魂历练”，避免与角色升级经验混淆。
- 产品决定：真实魂兽战斗胜利增加 20、战败增加 10、成功脱离增加 5 点猎魂历练及该种魂兽了解度；了解度在 100 封顶，历练累计不封顶。
- 边界：NPC、训练木偶和未标记为魂兽的最终 Boss 不记录；历史只保留最近 12 条，防止存档无限增长。

## 实现范围

- 新增 `frontend/src/utils/beast-knowledge.js`：归一化、了解度阶段、结算、摘要和简记排序纯函数。
- 修改 `frontend/src/stores/combat.js`：为角色战斗状态新增 `huntingKnowledge` 及统一结算入口。
- 修改 `frontend/src/engine/save.js`、`frontend/src/stores/serializer.js`：旧档安全补空值，新字段随本地/服务器存档往返。
- 修改 `frontend/src/composables/useBattleSystem.js`：仅真实魂兽的胜利、战败、脱离进入简记；胜利结果展示猎魂历练增量。
- 修改 `frontend/src/data/game-data.js`、`frontend/src/utils/ring-hunt.js`、`frontend/src/composables/useEventEngine.js`、`frontend/src/components/SceneArea.vue`：首环三种魂兽使用稳定中文 ID，并在候选策略中显示该角色的既有记录。
- 修改 `frontend/src/components/StatusPanel.vue`：新增可折叠的角色猎魂简记。
- 新增 `frontend/tests/beast-knowledge.test.js` 7 项，修改 `frontend/browser-smoke.mjs` 增加真实首环与移动端验收。
- 新增 3 张只写一次的实际效果截图；未修改魂兽数值、角色升级经验、魂环年限规则或既有存档文件。

## 测试结果

- `npm run validate:data`：通过，13 个 JSON、9 个魂环事件。
- `npm run build`：通过，Vite 85 modules。
- 根 Node 测试：58/58 通过。
- 前端 Vitest：162/162 通过，其中本 BUG 新增 7 项。
- `npm run test:browser`：通过，完整创建、觉醒、事件、旅行、首环和 BUG-DIALOG-001～013 回归链路完成。
- 说明：根 `npm test` 的子 npm 在 Node.js v24.14.0 完成全部 58+162 断言后触发 `tinypool` 退出清理异常；同一前端命令独立执行退出码为 0。这是测试运行器进程清理问题，不是断言失败，最终总回归需继续观察。

## 真实浏览器结果

- 既有记录为 20 时，百年疾风兔选项实际显示“猎魂简记：初识 20/100 · 1战1胜”。
- 再次战胜百年野兔后，存档变为历练 40、了解度 40/100、2 战 2 胜、最高百年；旧记录保留，新记录插入首位。
- 结果正文实际显示“猎魂历练+20”，左侧简记显示“熟悉 40/100”“2战 2胜”和最近两条猎环胜利。
- 390×844 页面无横向溢出；完整浏览器链路无新增页面或控制台错误。

## 实际效果证据

- 候选中的已有了解：`docs/local/bug-dialog-013/bg013-after-1440-choice-prior-knowledge.png`
- 桌面展开简记：`docs/local/bug-dialog-013/bg013-after-1440-hunter-journal-expanded.png`
- 移动端展开简记：`docs/local/bug-dialog-013/bg013-after-390-hunter-journal-expanded.png`

## 剩余风险

- 当前了解度是战斗经验摘要，不会提前揭示魂兽隐藏技能或掉落，避免把简记变成攻略剧透。
- 了解度阶段和 20/10/5 增量是本轮产品常量；未来若加入观察、追踪、驯养玩法，应统一从同一结算工具扩展。
- 移动端通知浮层会短暂覆盖状态栏顶部，但简记内容没有裁切且可正常滚动；该通知行为已在 BUG-DIALOG-010 单独验收。
