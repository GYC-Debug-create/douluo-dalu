# BUG-DIALOG-015 实施与审查报告

## 审查结论

`ACCEPTED`（2026-08-06）。第一次魂兽实战不再显示写死的“未达到 Lv.10”；事件进入和选择结果均按角色实际等级与魂环数量生成状态。Lv.10 及以上但没有第一魂环的旧档会恢复正式猎环目标，并优先进入第一魂环年限抉择；已经拥有第一魂环的 Lv.12 角色参加实战训练不会重复授环，并明确下一魂环在 Lv.20 解锁。

## 已确认事实与产品决定

- 用户截图已确认：左侧角色为 Lv.12，但“第一次魂兽实战”结果仍显示“当前等级未达到 Lv.10”。
- 源码事实：`first_hunt` 正文和三个结果曾分别写死未达到 Lv.10；正式猎环判定则根据实际等级和魂环数量执行，两套状态没有共用事实来源。
- 产品决定：“第一次魂兽实战”是训练事件，与正式猎环分离。Lv.5/Lv.9 应显示当前等级及距 Lv.10 的准确差值；Lv.10/Lv.12 无魂环应恢复并优先处理正式第一魂环；Lv.12 已有第一魂环时是补课训练，不重复授环，下一目标为 Lv.20。
- 兼容决定：旧档的 `pendingRingLv` 根据实际等级和已拥有魂环数重新推导；正式猎环的挂起状态继续独立保存。没有修改魂环等级门槛、授环奖励、世界观或成长公式。

## 实现范围

- 修改 `frontend/src/utils/ring-hunt.js`：新增第一次魂兽实战的动态状态生成与事件准备函数，统一训练进入和选择结果的玩家可见文案。
- 修改 `frontend/src/composables/useEventEngine.js`：显示事件时先注入真实训练状态，再按既有规则处理正式猎环事件。
- 修改 `frontend/src/data/game-data.js`：移除三个选择结果中的静态错误等级结论，只保留中性训练叙事。
- 修改 `frontend/src/engine/save.js` 与 `public/save-utils.js`：旧档按“下一魂环序号 × 10”及实际等级恢复 `pendingRingLv`，没有待处理目标时清理陈旧延后标记。
- 新增 `frontend/tests/first-hunt-status.test.js` 7 项；根 `tests/save-utils.test.js` 新增 1 项；`frontend/browser-smoke.mjs` 增加 Lv.9、Lv.10、Lv.12 无环及 Lv.12 已有首环的真实页面验收，并稳定了 BUG-011 的满状态测试种子。
- 未修改用户实际存档、魂环门槛、魂兽战斗数据、经验或授环公式。

## 测试结果

- `npm run validate:data`：通过，13 个 JSON、9 个魂环事件；保留既有 10 张大于 1 MB 图片警告。
- `npm run build`：通过，Vite 86 modules。
- 根 Node 测试：60/60 通过，其中本 BUG 新增 1 项旧档迁移测试。
- 前端 Vitest：175/175 通过，其中本 BUG 新增 7 项。
- `npm run test:browser`：通过，完整链路及 BUG-DIALOG-001～015 回归通过。
- 根聚合命令 `npm test` 在 Node.js v24.14.0 下仍可能于所有断言通过后触发 `tinypool` 子进程清理异常；同等根测试和前端测试分别执行均退出 0，未发现业务断言失败。

## 真实浏览器结果

- Lv.9、零魂环：事件正文显示“当前 Lv.9，距离第一魂环资格 Lv.10 还差1级”，选择后显示训练完成并再次给出准确差值；不会授环。
- Lv.10、零魂环：即使旧档原 `pendingRingLv=null`，加载后恢复为 10，正式“第一魂环·年限抉择”优先出现，侧边猎环目标显示已解锁。
- Lv.12、零魂环：同样恢复 Lv.10 第一魂环目标，390×844 下没有横向溢出。
- Lv.12、已有第一魂环：第一次魂兽实战明确显示“不会重复授环；第2魂环将在 Lv.20 解锁”。
- 页面中不再出现“当前等级未达到 Lv.10”或“你的魂力还远未达到 Lv.10”的静态错误结论；除既有缺失素材外，控制台和关键网络错误为 0。

## 效果对比证据

- 修复前用户原图：`docs/local/bug-dialog-015/bg015-before-user-feedback.png`
- 修复后 Lv.9 训练状态：`docs/local/bug-dialog-015/bg015-final-after-1440-lv9-training-status.png`
- 修复后 Lv.9 训练结果：`docs/local/bug-dialog-015/bg015-final-after-1440-lv9-training-result.png`
- 修复后 Lv.12 已有第一魂环：`docs/local/bug-dialog-015/bg015-after-1440-lv12-owned-ring-training.png`
- 修复后 Lv.10 正式猎环已恢复：`docs/local/bug-dialog-015/bg015-after-1440-lv10-formal-ring-ready.png`
- 修复后 Lv.12 无魂环移动端：`docs/local/bug-dialog-015/bg015-after-390-lv12-formal-ring-ready.png`

## 剩余风险

- `first_hunt` 既有图片 `/assets/beasts/one_eye_wolf.jpg` 在当前项目中缺失，真实浏览器会产生该资源的 404；它不是本 BUG 的等级状态根因，本轮没有越界补图。训练正文和交互仍可完成，但后续应作为独立素材缺失问题处理。
- 旧档目标恢复以当前规则“第 N 个魂环在 Lv.N×10”推导；若未来调整魂环门槛，迁移和状态文案必须继续复用同一规则来源。
