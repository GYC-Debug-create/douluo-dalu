# BUG-DIALOG-011 实施与审查报告

## 1. 问题与产品结论

第一魂环流程原先把三个候选全部固定为十年魂兽，玩家无法根据自身状态选择年限、风险与成长方向。本轮采用“稳定路线 + 两条百年挑战路线”：十年灵鹿强调低风险生存，百年疾风兔强调速度成长，百年毒蛛强调强攻控制。三条路线都可选择，系统只根据先天魂力、当前生命和武魂方向给出可读评估，不用隐藏锁强迫玩家接受某一方案。

本轮世界观边界为：Lv.10 的第一魂环阶段可以主动挑战百年魂兽，但不开放千年魂兽；挑战失败不会获得魂环，并沿用既有暂缓机制。

## 2. 实际修改

- `frontend/src/data/game-data.js`：第一魂环事件改为十年/百年三条真实路线，并补齐魂兽、年限、方向和策略元数据。
- `frontend/src/utils/ring-hunt.js`：集中处理候选对应魂环、显式魂兽年限和个性化评估。
- `frontend/src/composables/useEventEngine.js`：按玩家实际选择授予对应魂环，记录年份与中文魂兽来源。
- `frontend/src/composables/useBattleSystem.js`：战斗敌人使用选项指定的十年/百年强度，不再由模糊内部键推断。
- `frontend/src/components/SceneArea.vue`：选择卡显示年限、风险、成长方向和当前评估。
- `frontend/tests/first-ring-choice.test.js`：新增 6 项针对性单元测试。
- `frontend/browser-smoke.mjs`：新增第一魂环三路线、百年实战、胜利授环及存档断言。

未修改神级保底、重新觉醒、地图旅行、成长门槛、旧存档格式或其他 BUG 的产品规则。

## 3. 自动化验证

- `npm run validate:data`：通过。
- `npm run build`：通过，共构建 84 个模块。
- `npm test`：通过，根测试 58/58，前端测试 149/149。
- `npm run test:browser`：通过，完整链路包含创建、觉醒、事件、战斗、旅行、存档恢复及 BUG-DIALOG-001～011 回归。

针对性覆盖包括：恰好一条十年与两条百年路线；任意候选均可选；高先天魂力推荐但不强制；普通或受伤状态仅警告不锁定；十年/百年战斗强度明确；特殊 60/90 年魂环映射不回归。

## 4. 真实游玩验收

真实 Chrome 在 1440×1000 与 390×844 下均展示三条完整策略，且无横向裁切。桌面流程选择“百年疾风兔”后，实际敌人为“百年野兔”；胜利后存档得到黄色第一魂环、年份 100、来源“疾风兔”，状态栏显示“疾风兔魂技 / 疾风兔 / 100年”。最终桌面截图中生命 230/230、魂力 181/181，与测试角色状态一致。

截图证据：

- `docs/local/bug-dialog-011/bg011-final-r3-after-1440-first-ring-strategy.png`
- `docs/local/bug-dialog-011/bg011-after-390-first-ring-strategy.png`
- `docs/local/bug-dialog-011/bg011-r2-after-1440-hundred-year-battle.png`
- `docs/local/bug-dialog-011/bg011-after-1440-hundred-year-result.png`

## 5. 审查结论与剩余风险

代码行为与玩家体验均达到本轮验收标准，可以关闭本问题。当前评估只使用已有先天魂力、生命和武魂方向，没有引入复杂概率或猎魂知识成长；后者留给 BUG-DIALOG-013。现阶段只有第一魂环配置了多年限策略，未来扩展第二及后续魂环时应复用同一数据模型并重新校准年限上限。
