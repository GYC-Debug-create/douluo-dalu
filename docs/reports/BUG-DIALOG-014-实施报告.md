# BUG-DIALOG-014 实施与审查报告

## 审查结论

`ACCEPTED`（2026-08-06）。新获得魂环与旧存档恢复后，魂环来源、魂技名称和关联魂兽都使用玩家可读中文，不再把 `spirit_deer_ten` 一类程序键显示到界面；原魂技伤害、消耗、冷却、年限和归属保持不变。

## 已确认事实与产品决定

- 用户截图已确认：状态栏出现 `spirit_deer_ten魂技` 和 `spirit_deer_ten`。
- 源码事实：旧首环链路曾直接把 `choice.result.battle` 拼接为魂技名；存档迁移以魂环 `skill/source` 为权威，因此旧值会持续进入 Vue 状态栏和战斗技能。
- 产品决定：建立统一玩家可见命名层。已知内部键映射到稳定中文魂兽名；未知英文内部键降级为“未知魂兽”，绝不原样泄漏；已有中文自定义魂技不重命名。
- 兼容边界：只在读取/生成对象时规范化显示字段，不直接改写 `data/player_*.json`，不改变魂技数值、魂环年限、颜色、奖励或战斗公式。

## 实现范围

- 新增 `frontend/src/utils/ring-names.js`：内部键别名、玩家可见来源、选项来源与旧魂环展示归一化。
- 修改 `frontend/src/composables/useEventEngine.js`：新魂环优先使用显式中文 `beastName/beastId`，不再从战斗键直接造文案。
- 修改 `frontend/src/engine/save.js`：旧魂环、对应魂技和已知 `beastId` 同步中文化。
- 修改 `public/save-utils.js`：保留兼容入口与 Vue 存档迁移的一致规则。
- 新增 `frontend/tests/ring-names.test.js` 6 项；根 `tests/save-utils.test.js` 新增 1 项；`frontend/browser-smoke.mjs` 增加旧档真实加载、桌面/移动端断言，并稳定 BUG-011 满状态测试种子。
- 未修改用户实际存档、魂兽/魂环数据文件和世界观规则。

## 测试结果

- `npm run validate:data`：通过，13 个 JSON、9 个魂环事件。
- `npm run build`：通过，Vite 86 modules。
- 根 Node 测试：59/59 通过。
- 前端 Vitest：168/168 通过，其中本 BUG 新增 6 项。
- `npm run test:browser`：通过，完整链路及 BUG-DIALOG-001～014 回归通过。
- 根 `npm test` 在 Node.js v24.14.0 中仍可能于所有断言完成后触发 `tinypool` 子进程清理异常；相同根测试和前端测试分别执行均退出 0，未发现断言失败。

## 真实浏览器结果

- 使用带有 `spirit_deer_ten` 来源、魂技和关联 ID 的旧存档进入正式 `#/game`。
- Vue 运行态实际得到：来源“灵鹿”、魂技“灵鹿魂技”、魂兽 ID“灵鹿”；对应战斗魂技同名，damage=42、cost=15、cooldown=3 原值保留。
- 1440×1000 与 390×844 的页面正文均不包含 `spirit_deer_ten`；移动端无横向溢出，页面/控制台错误为 0。

## 效果对比证据

- 修复前用户原图：`docs/local/bug-dialog-014/bg014-before-user-feedback.png`
- 修复后桌面旧档：`docs/local/bug-dialog-014/bg014-after-1440-old-save-chinese-ring.png`
- 修复后移动端旧档：`docs/local/bug-dialog-014/bg014-after-390-old-save-chinese-ring.png`

## 剩余风险

- 当前映射覆盖现有战斗引擎已知魂兽键；未来新增内部键但未同步别名时会显示“未知魂兽”，不会泄漏英文，但需要补充正式中文名。
- 旧档中已经是中文的自定义魂技按原文保留；本轮不尝试根据武魂属性重新生成技能，以免改变玩家既有成长结果。
