# BUG-DIALOG-012 实施与审查报告

## 1. 问题与产品结论

达到猎环等级后，原实现只发一次通知；左侧空魂环槽虽然存在，却因为 `ringSlots.length` 至少为 1，旧目标卡永远不会显示。玩家离开提示后无法确认要获取第几魂环、去哪里，也不能主动挂起或恢复。

本轮比较了三种方向：A 继续使用通知但延长时间；B 在主叙事顶部放任务条；C 在“主线与魂环”下固定一张猎环目标卡。最终采用 C：它不推动主事件布局，与魂环状态相邻，并能长期显示序号、解锁等级、目的地、挂起状态和操作入口。

## 2. 实际修改

- `frontend/src/utils/ring-hunt.js`：统一九个猎环等级的真实目的地，并新增纯函数生成当前目标状态。
- `frontend/src/components/StatusPanel.vue`：新增固定猎环目标卡，提供“查看地图 / 继续猎环 / 暂缓提醒”。
- `frontend/src/pages/GamePage.vue`：把目标卡操作接回同一事件引擎。
- `frontend/src/composables/useEventEngine.js`：新增显式挂起与恢复；挂起三次行动但不清目标，恢复立即回到目的地引导或猎环事件，成功授环仍清空目标。
- `frontend/tests/ring-objective.test.js`：新增 6 项目标状态和交互契约测试。
- `frontend/browser-smoke.mjs`：新增跨刷新、错误地点、正确地点、完成后清除及移动端验收。

没有新增存档字段；继续使用并持久化既有 `pendingRingLv` 与 `_ringHuntDeferredUntil`，旧存档兼容路径不变。

## 3. 自动化验证

- `npm run validate:data`：通过，13 个 JSON、9 个魂环事件。
- `npm run build`：通过，84 个模块。
- `npm test`：通过，根测试 58/58，前端测试 155/155。
- `npm run test:browser`：通过完整真实 Chrome 回归。

## 4. 真实游玩验收

真实 Chrome 验证了：Lv.10 第一魂环目标固定显示；在圣魂村时明确指出星斗大森林·外围；挂起后显示剩余 3 次行动，刷新仍保留；点击“立即继续”进入猎环前置而非丢失目标；目的地正确时显示“已抵达猎环区域”；390px 无横向溢出；百年魂兽胜利并获得魂环后，目标卡、`pendingRingLv` 与挂起计数同时清除。页面控制台没有产品错误。

对比证据：改前可参考 `docs/local/bug-dialog-011/bg011-final-r3-after-1440-first-ring-strategy.png`，左侧只有空魂环槽；改后为：

- `docs/local/bug-dialog-012/bg012-final-r2-after-1440-objective-deferred.png`
- `docs/local/bug-dialog-012/bg012-final-r2-after-1440-objective-travel-ready.png`
- `docs/local/bug-dialog-012/bg012-final-r2-after-390-objective-at-destination.png`

## 5. 审查结论与剩余风险

代码状态、存档行为和玩家可见流程均达到验收标准，可以关闭本问题。目标卡在移动端位于状态区内，需要向下滚动才能看到主叙事，但不会横向裁切；这与现有移动端状态面板顺序一致。猎魂知识、了解度和历史记录属于 BUG-DIALOG-013，不在本轮混改。
