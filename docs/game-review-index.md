# 斗罗大陆文字 RPG — 审查索引（Review Index）

> 用途：按模块逐项审查。每项含「位置」「状态」「审查要点」。
> 状态图例：✅ 已验证可用 ｜ ⚠️ 存在已知问题/风险 ｜ ❓ 待验证/需人工确认
> 生成时间：2026-08-02（基于任务书修复完成后全量通读与实测）

---

## A. 入口与框架层

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| A1 | 正式文字 RPG 入口 | `public/game.html`（路由 `#/title`、`#/game`、`#/map`、`#/codex`） | ✅ | 标题页/创建/觉醒/游戏/地图/图鉴 六屏切换 |
| A2 | 旧版 canvas 入口 | `public/index.html` + `public/js/*`（main.js/pixel-art.js…） | ❓ | 与文字版并存，是否仍需维护？样式走 `css/style.css` |
| A3 | 服务器 | `server.js`（静态资源 + 存档 API + CSP 头） | ⚠️ | ① 存档 API **无鉴权**：任意 `playerId` 可读/删/改；② 端口默认 3000，正式用 31876（环境变量）；③ 存档上限 2MB |
| A4 | 地图页 | `public/map.html`（iframe 嵌入，1600×900 缩放） | ✅ | 27 个地点标记、迷雾、拖拽/缩放/图例 |
| A5 | 图鉴页 | `public/codex.html`（武魂/魂兽/魂环/NPC/魂骨/地点 6 类） | ✅ | 品级中文映射已完成 |
| A6 | 调试页 | `public/debug-saves.html` | ❓ | 本地调试用，生产是否暴露？ |
| A7 | 样式 | `game.html` 内联 CSS + `css/text-combat.css` + `css/style.css` | ⚠️ | 两套 CSS 并存（旧版 style.css / 文字版内联），易分叉 |

## B. 数据与配置层

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| B1 | 武魂/魂兽/魂环/魂技/地图/NPC/魂骨/地点/武魂事件 13 个 JSON | `public/data/*.json` | ✅ | `npm run validate:data` 通过（13 文件、9 猎环事件）；实测条目：武魂70/魂兽30/魂环12/魂骨31/NPC33/地点27/武魂专属事件168 |
| B2 | 基础事件库 | `public/game-data.js`（EVENTS 65 个 + 出身/技能树/成就72/称号41/结局27/分支/挑战塔/签到/锻造/任务/商店/修炼/动态事件） | ✅ | 与 expanded 合并后 340；ID 唯一；阶段/等级带宽充足（B 轮实测 lv10→340 全覆盖） |
| B3 | 扩展事件库 | `public/game-events-expanded.js`（275 个地点事件） | ✅ | `location` 正则兜底归类已复核：**0 个无法归类**；部分地点事件池偏薄（见 B-04）。剩余插槽：global 事件过少（adventure 1 / master 3） |
| B4 | 图片资源 | `public/assets/`（225 张，≈119MB） | ✅ | **已逐一核对：0 缺失**。事件英文键经 `EVENT_ASSET_ALIASES`(30条) 映射到中文均可达；风险=体积（单图最大1.28MB、无缓存头/压缩） |
| B5 | 事件阶段分布 | EVENTS 的 `phase`（academy/adventure/master/god） | ✅ | 实测：academy115 / adventure81 / master61 / god83；断带宽 169→340 充足；**薄弱点**是地点内单池与"全球通用事件"偏少（B-04 已列） |

## C. 存档系统（高风险区）

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| C1 | 迁移/校验 | `public/save-utils.js`（migrateSave、备份链、别名表） | ✅ | 幂等性有测试；personality/destiny 字符串归一化已修 |
| C2 | 本地存档 | `game.js` saveLocal（主键+backup+hist1~5） | ✅ | beforeunload 自动保存 |
| C3 | 服务器存档 | `game.js` saveServer → `POST /api/player/save` | ⚠️ | **实测发生过：读取某角色后进入游戏，autosave/回标题会静默覆盖磁盘存档**（无差异确认）；多标签页互相覆盖风险 |
| C4 | 自动存档 | `game.js` startAutoSave（15 秒） | ⚠️ | 15 秒窗口内崩溃丢进度；与服务器保存混用无节流 |
| C5 | 存档选择 | `game.js` openSaveList（本地+云端列表） | ✅ | 「继续冒险」已接入多存档选择 |
| C6 | 备份链深度 | localStorage 1 主 + 1 备份 + 5 历史 | ❓ | 长期游玩是否够；服务器无历史版本（每次覆盖） |
| C7 | 双端一致性 | 本地档（migrate 后）vs 服务器档（旧结构） | ⚠️ | 本地已升级、云端仍旧时，openSaveList 显示两行同一角色（本地＋服务器），玩家可能混淆 |

## D. 角色与成长

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| D1 | 创建/觉醒 | `game.js` createPlayer / doAwaken / 自选神级入口 | ✅ | 预览与最终属性同一函数（四出身实测一致） |
| D2 | 属性计算 | `calcBaseStats` / `previewStats` / `finalStats` | ✅ | 唯一口径；武器/出身/魂环/称号/技能树/NPC 加成叠加 |
| D3 | 经验/等级 | `gainExp` + `game-rules.js` advanceExperience | ✅ | 累计经验守恒有测试；溢出经验显示已修 |
| D4 | 魂环门槛 | `game-rules.js` RING_LEVELS / levelCapForRings | ✅ | 无环封顶 10 级…九环 100 级 |
| D5 | 魂环/魂技 | `grantRing` / `makeRing` / 猎环事件链 | ❓ | **Lv.10→Lv.90 各次猎环完整流程未实测**（只验证到 4~5 环数据与 1 环流程） |
| D6 | 技能树 | `game-data.js` SKILL_TREE（off/def/agi/mp 分支） | ❓ | 每 5 级 2 点，节点成本 1~3，**点数上限与全部节点解锁是否平衡未算** |
| D7 | 称号/成就 | 成就 12 项（实测档）+ 称号系统 | ❓ | 成就奖励数值与触发条件未全量核对 |
| D8 | 修炼/锻造/签到 | `openTraining` / `openForge` / `openDailySign` | ❓ | 锻造配方/签到 7 日循环奖励曲线未平衡验证 |
| D9 | 挑战塔 | `openChallengeTower`（20 层） | ❓ | 20 层难度曲线、奖励未实测 |

## E. 事件与剧情

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| E1 | 事件抽取 | `nextEvent` / `availableEvents` / `eventMatchBonus` | ✅ | 按阶段/等级/地点/武魂/权重过滤 |
| E2 | 事件执行 | `applyChoice` / `applyResultRewards`（结构化奖励） | ✅ | 明细总计=实际变化（战斗+事件实测） |
| E3 | 主线里程碑 | `MAIN_STORY_MILESTONES`（first_hunt→reach_lv10→…） | ⚠️ | `reach_lv10.isComplete` 字段**从未被读取**（死字段）；后续主线里程碑完整链未验证 |
| E4 | 结局系统 | `showEnding` + `ENDINGS`（abyss_lord/ordinary_happiness/rebel_hero/dark_redemption 等） | ❓ | **结局分支、最终 Boss、后期主线完全未实测**（任务书也标注未验证） |
| E5 | 早年经历/序章 | `playEarlyLifeNodes` / `playPrologue` | ✅ | 旧档不重播（迁移标记有测试） |
| E6 | 故事路径 | `_storyPath` / `_storyDecisions` / STORY_BRANCHES | ⚠️ | 早期选择对**后续事件权重/对话**无影响（只影响结局/成就/面板展示）；`_academyRecommendation` 已改为面板可见 |
| E7 | 日记 | `addDiaryEntry`（上限 200 条） | ✅ | 与瞬态 toast 分离 |

## F. 地图与探索

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| F1 | 地点体系 | `map-data.json`（英文 id）+ `map.html` LOCATIONS（中文 id）+ `location-codex.json` | ⚠️ | 三套键名靠映射表连通；**新增地点时易漏同步** |
| F2 | 旅行 | `travelToLocation` / `openFastTravel` / 战争迷雾 | ✅ | 相邻/已探索/金币/等级限制；菜单收起已修 |
| F3 | 隐藏地点 | `HIDDEN_LOCATIONS`（6 个）+ 帮助页线索 | ✅ | 线索已补；发现=自动触发，无「主动寻找」交互 |
| F4 | 地图交互 | marker 点击/文字/键盘/触摸 | ✅ | label 独立绑定已修；**相邻 marker 点击区重叠**（hover 放大后更明显）是已知体验问题 |
| F5 | 随机遭遇 | `RANDOM_ENCOUNTERS` / 商人 / 事件 | ❓ | 权重与等级分布未统计 |

## G. 战斗系统

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| G1 | 回合循环 | `game-combat.js`（攻击/技能/防御/道具/逃跑） | ✅ | 战斗内外道具逻辑一致（满血不扣已修） |
| G2 | 结算 | finishVictory / finishDefeat / 奖励明细 | ✅ | 经验总计=实际变化；任务/成就分类已修 |
| G3 | 元素/连击/暴击/状态 | 元素克制、反应链、连击终结、极限突破、debuff | ❓ | **数值与触发条件无自动化测试**，仅代码阅读 |
| G4 | NPC 切磋 | `interactNpc` battle 类型 | ✅ | 经验文案用实际值已修 |
| G5 | Boss | 深渊之主/最终 Boss | ❓ | 未实测；Boss 难度曲线未知 |

## H. NPC 与社交

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| H1 | 结识 | `meetNpc`（幂等） | ✅ | 实测只提示一次 |
| H2 | 关系/好感 | `_npcRelations` + NPC_RELATION_LEVELS（20~500 档） | ❓ | 500 满好感达成路径未实测；好感数值来源（互动/事件）覆盖是否充分 |
| H3 | 冷却 | `_npcCooldowns`（按行动数） | ✅ | 实测冷却正确、可保存 |

## I. 界面与体验

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| I1 | 通知 | toast / 升级通知 / 成就横幅 | ⚠️ | 任务书要求「同一时间最多一条主通知」，当前 rail 可**并行多条堆叠**（未严格串行）——待按需求取舍 |
| I2 | 响应式 | 5 视口实测通过 | ✅ | 390×844 / 844×390 / 768×1024 / 1366×768 / 1920×1080 |
| I3 | 弹窗 | openModal 体系 | ❓ | 长内容弹窗（图鉴/日记 200 条）移动端滚动体验未细测 |
| I4 | 无障碍 | aria / 键盘 | ❓ | 引导/地图 marker 有 aria；**全站 Tab 顺序/焦点陷阱未系统审查** |
| I5 | 新手引导 | `startTutorial`（8 步） | ✅ | 跳过/稍后再看/设置重看完整 |
| I6 | 开场 | CinematicEngine + 序章 | ✅ | 跳过即时生效（实测） |

## J. 视觉与音频

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| J1 | 电影开场 | `game-visual.js` CinematicEngine | ✅ | 首次标记/直进标题/手动跳过 |
| J2 | 特效/粒子/音频 | VisualFX / ParticleEngine / AudioFX | ❓ | 性能（地图粒子常驻）、reduced-motion 覆盖、音频文件是否存在 |

## K. 代码卫生与维护

| # | 模块 | 位置 | 状态 | 说明 / 审查要点 |
|---|---|---|---|---|
| K1 | 死代码 | `renderStatusIcons()` 恒返回空串；`getDiscoveredLocations()` 无调用；`reach_lv10.isComplete` 无读取 | ⚠️ | 清理或接线 |
| K2 | 硬编码联动 | 地点中文名/id、RING_DESTINATIONS、成就 ID、NPC ID 散落代码与 JSON | ⚠️ | 改数据需全局 grep，易漏 |
| K3 | 事件奖励字段 | `hp`（兼容字段）已统一 heal/damage；`result.item` 与 `effect` 对象 | ✅ | validate 有检查 |
| K4 | 测试覆盖 | tests/ 8 个文件 44 项 | ⚠️ | **缺口：Lv.10+ 全流程、Boss、结局、服务器读写、真实存档回归、战斗数值** |

## 建议审查顺序（按风险）

1. **C（存档系统）** — 已发生真实事故（覆盖写），且直接影响玩家数据
2. **E4（结局/最终 Boss/后期主线）** — 任务书明示未验证
3. **D5（魂环全流程）+ B5（高等级事件池）** — 成长主线完整性（B 轮 2026-08-03 已实测：B5 高等级池充足、无 ❓）
4. **G（战斗数值/元素反应）** — 无测试，平衡未知
5. **B4（图片资源全量核对）+ I1（通知严格性）** — 内容/体验
6. **K1/K2（死代码与硬编码）** — 维护性收尾
