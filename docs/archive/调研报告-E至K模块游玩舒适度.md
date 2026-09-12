# 《斗罗大陆·武魂觉醒》游玩舒适度调研报告（E–K 模块）

> 创建时间：2026-08-03
>
> 调研立场：以「游玩舒适度」为核心，即玩家能否清楚知道下一步做什么、奖励是否可信、失败是否有明确后果、界面是否遮挡操作、长线是否有成长感。不重复 A 区（入口与框架）已审查内容，可参考 `docs/reports/入口与框架-A-深度体验审查.md`。
>
> 数据基线：`npm test`（多轮递增至 29/29～44/44）；`npm run validate:data` 通过（13 JSON、9 猎环事件、508 稳定事件 ID）。
>
> 本文档只记录结论与开发方向，不含具体修复补丁；如需实施请按模块另开任务。

---

## 0. 总览

### 玩家舒适度的五条核心判断线

1. **入口→目标**：玩家是否知道下一步做什么（主线/魂环/任务/地点入口是否闭环）。
2. **数值可信**：界面展示的数值与实际到账是否一致（预览、奖励、掉落、称号、结局）。
3. **后果可感**：玩家的选择是否带来可感知的长期变化（世界、NPC、事件池、结局）。
4. **状态一致**：地图地点、事件地点、当前状态、存档是否同源。
5. **干扰最小**：通知、弹窗、移动端布局是否遮挡正文与操作。

### 各模块舒适度评级

| 模块 | 评级 | 一句话结论 |
|---|---|---|
| E. 事件与剧情 | ⚠️ 部分闭环 | 事件抽取已修，主线里程碑存在「死字段」且后期主线/结局未实玩 |
| F. 地图与探索 | ⚠️ 可用但无策略 | 旅行=扣钱跳转；三套地点键名靠映射表和正则兜底，硬编码联动风险高 |
| G. 战斗系统 | ✅ 架构扎实 | 状态机/元素反应/结算差额闭合均有实现与测试，缺「数值平衡/高难度场景」测试 |
| H. NPC 社交 | ⚠️ 数值农场 | 结识/冷却已修；好感 20→500 是「重复点击刷数值」，无阶段剧情回报 |
| I. 界面体验 | ⚠️ 移动端收尾 | 通知已串行化、响应式已通过；但标准 1366 下长图鉴/日记滚动、通知优先级仍待取舍 |
| J. 视觉音频 | ✅ 可压制耗 | 粒子/特效/WebAudio 齐全；性能瓶颈集中在地图常驻粒子与音频文件缺失 |
| K. 代码卫生 | ⚠️ 结数据结构类 | 死代码 3 处已定位；硬编码联动散落；服务器存档无鉴权；测试缺口聚焦 Lv.10+ |

---

## E. 事件与剧情

### 代码位置（证据）

- 主线里程碑 `MAIN_STORY_MILESTONES`：`public/game.js`（约 L1763，first_hunt→reach_lv10→…→final_evil Lv95）。
- 结局 `ENDINGS`：`public/game-data.js:1112`，`minFate` + `req` 优先匹配。
- 剧情分支 `STORY_BRANCHES`：`public/game-data.js:1354`（decisions/options）。
- 动态事件/连锁事件/时间/天气：`public/game-data.js`（约 L1572+ DYNAMIC_EVENTS / L1723+ CHAINED_EVENTS / L1821+ TIME_PERIODS / L1828+ WEATHER_TYPES）。
- 日记：`addDiaryEntry`/`openJournal`（game.js 约 L4597/4612），上限 200 条，5 类过滤 + 搜索。
- 事件抽取 `nextEvent`/`availableEvents`：优先级「最终 Boss → 待魂环 → 动态事件 → 随机遭遇 → 连锁 → 阶段池」；`level/phase/location/spirit` 过滤与权重。
- 近期冷却 `recentCooldown`（最近 12 个，回退 5）。
- 帮助页文案中“探索按钮”已由正文改为真实按钮，但需逐条复核 vs `docs/game-review-index.md` E6/UX-021。

### UI 已修复（2026-07/08 完成）

- 事件重复 ID：源数据清理，运行时遇重复/缺失 ID 直接报错，校验纳入 `validate:data`（UX-005）。
- 阶段/等级冲突：`availableEvents` 过滤条件与自动校验统一（UX-006）。
- 魂环技能名与战斗魂技名：存档迁移以魂环 `skill` 为权威值生成稳定 `skillId`（P1-01）。
- 早年经历/序章：`E5` 旧档不重播，迁移标记有测试。

### 调研结论（可复用）

| # | 发现 | 类型 | 影响舒适度 | 方向 |
|---|---|---|---|---|
| E1 | `reach_lv10.isComplete` 字段从未被读取（死字段） | 死代码 | 中｜主线里程碑无实感 | 接线到主线状态卡或删除，二者择一 |
| E2 | 后续主线里程碑（reach_lv10→soul_master_prelim→…→final_evil）未**完整**完成一次自然游玩 | 真实验证缺口 | 高 | 安排一次 Lv.10→Lv.95 的无痕自然首通回归，记录每档主线入口的可达性 |
| E3 | 早期 STORY_BRANCHES 决策只写 path 计数，不影响后续事件权重/对话（见 `E6` marker） | 设计取舍 | 中 | 在不引入庞大状态机前提下，用「关键决策标签」让 2~3 个后续事件显式引用 |
| E4 | 结局/最终 Boss/后期主线完全未实测；多条件同时满足时结局按数组顺序优先匹配，无玩家选择/解释 | 验证缺口+设计 | 高 | 人工开辟高等级存档完成一次 final_evil；并增加“满足多个结局条件时提示优先级” |
| E5 | 事件总量大但「结果结构趋同」（经验+小属性+命运值），中后期选择感弱（UX-020） | 设计取舍 | 中 | 增加少量「修改世界状态」的选择（势力/地点开关/NPC 后续），而不是继续堆事件 |
| E6 | 事件 `location` 靠正则 `EVENT_LOCATION_HINTS` + 别名表归类，语义含歧义（如「星斗小村·猎户家」归外层） | 数据质量 | 低 | 建议 validate 阶段增加「模糊地点条目人工复核清单」，产出一份迁移对照 |
| E7 | 帮助文案与实操仍有少量口径不一致（项目辅助「探索按钮」），自动战斗 AI 并不完整执行描述中的「道具/逃跑」策略 | 文案/逻辑 | 中 | 帮助只描述当前真实可用系统；攻防策略文案对齐 `autoAction()` 实际行为 |

---

## F. 地图与探索

### 代码位置（证据）

- 地点键名：`map-data.json`(英文 id：`shrek_academy`)、`location-codex.json`(中文名 id：`史莱克学院`)、事件散文位置；三套靠 `resolveMapLocation`(game.js 约 L3487) 别名表连通。
- 旅行：`travelToLocation`(L3567)/`travelCost`(L3561)/`openFastTravel`(L3837)；`map.html` iframe 1600×900 缩放嵌入。
- hidden 地点：`HIDDEN_LOCATIONS`(6)+ `checkHiddenLocationReveal`(L3630) + `getDiscoveredLocations`(L3624)。
- 随机遭遇：`RANDOM_ENCOUNTERS`(L3646) / `triggerRandomEncounter`(L3710) / 商人 / 随机事件。
- `visitedMapIds`(L3509) / `syncMapState`(L3520) / `openMap`(L3549)。

### 已确认/已修复

- 地图空白页（P1-02）已修：map iframe 实际展示 27 地点、迷雾、拖拽缩放图例（实测通过了）。
- 旅行闭环：相邻/已探索/金币/等级限制正常，菜单收起已修。
- 帮助文案“移动：相邻地点点击”：地图 marker 点击跳转已接入，但相邻 marker 点击区重叠（缩放后放大时明显）仍是已知体验问题；另外「战争迷雾」「相邻地点点击移动」在帮助中是否存在需再次人工逐条比对。

### 调研结论

| # | 发现 | 类型 | 影响 | 可溶性 |
|---|---|---|---|---|
| F1 | **三套地点键名** (map-data / location-codex / 事件文本) 靠映射表+正则连通，新增地点极易遗漏同步 | 代码卫生 | 高 | validate:data 增加「地点引用全量扫描」：map-data 的 id、location-codex 的 id、事件 location 经 EVENT_LOCATION_HINTS 后能互达；新增地点必须至少走一遍校验 |
| F2 | 旅行=「扣金币→可能的遭遇→抵达文本」，`travelTime` 只换算金币，无时间/遇险率/抵达后事件池差异 | 设计 | 高 | 旅行动画/文本至少显示：目的地双方等级、行动耗时、遭遇概率、抵达后「地点专属事件标签」；快速旅行与安全旅行的差异要写清 |
| F3 | 隐藏地点发现=自动触发+发奖励，无「主动寻找」交互（UX-014 部分保留） | 设计 | 中 | 在 6 个 hidden 处至少把「发现后→地图标出→专属事件→再访奖励」做通，用主线提示引导 |
| F4 | 非 Map-data 地点无法映射时 `availableEvents` 直接放行，事件可能出现于任何地点 | 数据 | 高 | 改为「未映射事件禁止出现」或在 validate 阶段报错（已有多条命中但 eventos 301 段，需**整体复核**漏网事件池） |
| F5 | 地图与旅行各维护一套地点数据（游戏脚印 `visitedMapIds` vs 旅行弹窗/地图 marker 各自再查一遍 LOCATIONS） | 设计 | 中 | 把地图 marker、旅行弹窗、location-codex 统一到单一 `state.currentLocationId` 数据源 |

---

## G. 战斗系统

### 代码位置（证据）

- 战斗核心：`public/game-combat.js`（约 967 行）。状态机 `state`：round/turn/logs/combo/cooldowns/statuses/defending/busy/ended/auto/speed/bossPhase/lastStand/limitBreak。
- 回合节奏：`performAttack/performSkill/performDefend/attemptFlee/enemyAction/endRound`。
- 胜利/失败结算：`finishVictory`(L612)/`finishDefeat`(L720)。
- 经验守恒：`gains`/`expBefore`/`actualTotal`/溢出补差；(L638~L684) explicit 对齐，有测试。
- 魂骨掉落：`maybeDropBone`（Boss 45% / 普通 12%，Boss 额外给 bone code 图鉴）。
- 元素反应：`ELEMENT_ICONS/NAMES`(12 元素)+`applyElementStatus`；状态表 `STATUS_INFO` + burn/poison/freeze/stun/weak/armorBreak/regen/rage/shield/haste。
- 动画偏好：`localStorage['dldl_battle_animation']` minimal/fast/normal + prefers-reduced-motion；`delayMs()` 480/300/80。
- `game-rules.js`：伤害公式 / `advanceExperience` / 魂环等级上限 / `ringBacklash` / `EVENT_LOCATION_HINTS`。

### 调研结论

| # | 发现 | 类型 | 影响 | 方向 |
|---|---|---|---|---|
| G1 | 回合循环、结算差额、逃跑失败/胜利状态机、道具一致性均有测试；战斗内外道具逻辑一致（满血不扣已修） | 稳固 | - | 作为后续改动回归基线，勿破坏 `finishVictory` 的「先清 state 再回调」模式 |
| G2 | 元素反应/连击/暴击/极限突破/lastStand/Obs 数值**无自动化测试** | 测试缺口 | 高 | 新增纯数值回归：特定攻击/防御/速度/hp 组合下验证伤害公式与暴击/克制/连击终结输出上限 |
| G3 | 动画偏好只影响 delayMs（3/2/1 倍速）；部分环境 prefers-reduced-motion 没被 `reducedMotion()` 全链路覆盖（如部分 CSS 动画/粒子） | 无障碍 | 低 | `no-motion` 类与 reduced-motion 媒体查询全站点一致 |
| G4 | `autoAction()` 技能选择用「找治疗→否则最后一项技能」，并不等于帮助文案的「技能→普攻→道具→逃跑」策略 | 文案/设计 | 低 | 对齐预告文案与实际行为，或在 AUTO 面板提供「进攻/均衡/保守」三流派参数 |
| G5 | Boss 战特殊技能（`狂暴重击`/`灭世冲击`）、阶段 1→4 的 CSV 无测试，玩家无法知道「阶段H→四段」变化 | 验证缺口 | 中 | 补 final_boss 全阶段回归脚本或手动 walkthrough |
| G6 | 战斗内「武魂融合」按钮需 ≥3 魂环才可用，但无前置提示「第几环解锁」 | 引导 | 低 | 战斗按钮下加一行解锁条件；Boss 战禁用逃跑时也注明（已有 disabled，但缺文案） |

---

## H. NPC 社交

### 代码位置（证据）

- `meetNpc`（game.js 约 L3989）幂等，实测只提示一次；地点访问不再批量结识（UX-011 已修）。
- `NPC_RELATION_LEVELS`（game-data.js:1518）档位 20→50→100→200→350→500(灵魂伴侣)。
- `NPC_INTERACTIONS`（game.js 约 L5792）：闲聊/送礼/重礼/切磋/协助/设宴，金币成本+冷却+等级门槛。
- `changeNpcRelation`（L5773）：clamp 0~500，升级→ toast + VisualFX + 日记。
- `NPC_RELATION_REWARDS`（L5808）。

### 调研结论

| # | 发现 | 类型 | 影响 | 方向 |
|---|---|---|---|---|
| H1 | 结识已幂等、冷却正确可存档 | 稳固 | - | 保持 |
| H2 | **好感从 20 刷到 500 无内容回报**（每档只有 toast+属性），不同 NPC 互动文案不变化；结局部分要求 500 好感但 UI 最高显示 350 | 设计 | 中 | ①每档解锁一句专属对话/事件 ②互动后显式「下一阶段将解锁什么」 ③UI 与结局好感上限统一到 500 或结局降为 350 |
| H3 | NPC 关系叠加为全局属性，玩家无法感知「谁贡献了什么」 | 设计 | 低 | 关系面板按人显示当前加成明细；结局条件引用具体 NPC |
| H4 | 切磋战斗已接入 BattleSystem，胜利文案用实际经验值（G4 线路） | 稳固 | - | - |

---

## I. 界面体验

### 代码位置（证据）

- 六屏路由 `#/title /create/game/map/codex`；`game.html`（约 L2185 布局 2100+ 行内 CSS）。
- `status-panel` 折叠 / `status-toggle` aria；`modal-mask` role=dialog aria-modal；`toast` role=status aria-live=polite。
- `TUTORIAL_STEPS`（game-data.js: L1529，8 步）+ `startTutorial`（game.js 约 L5552）+ Esc 跳过 + `dldl_tutorial_done`。
- `playPrologue`（game.js 约 L825）序章自动播放/跳过。
- `accessibility.test.js` 覆盖 aria 语义/表单 label/地图图例按钮。

### 调研结论

| #/编号 | 发现 | 类型 | 影响 | 方向 |
|---|---|---|---|---|
| UX-023/024 | 移动端状态栏默认折叠；宽屏剧情区最宽 1680/正文 1100/选项 1280，边界不齐 | 已修复 | - | 复核确认 |
| I-1 | 长内容弹窗（图鉴/日记 200 条）移动端内部滚动/横屏未细测 | 验证缺口 | 中 | 用 390×844/844×390 手动滚一遍图鉴/日记，验证固定底部按钮 |
| I-2 | 通知优先级：任务书「同时一条主通知」，当前 rail 可能并行堆叠（未严格串行） | 体验取舍 | 中 | 如需严格串行，将 toast 队列在 I1 改造（当前引导不重叠） |
| I-3 | 全站 Tab/焦点陷阱未系统审查；指引有 aria 但弹窗打开后焦点不转移到 modal-head 外的可调用区 | 无障碍 | 低 | 增加一份 Tab 顺序 + modal 焦点循环的检查 |
| I-4 | 开场跳过已即时生效（已验证）；序章跳过后进入早年未重放（已验证） | 稳固 | - | - |
| I-5 | 帮助文本与实操仍有差异（参考 E7），建议按「创建/主线/随机/战斗/存档」分阶段重排 | 文案 | 中 | 见开发方向 D-2 |

---

## J. 视觉与音频

### 代码位置（证据）

- `game-visual.js`：`ParticleEngine`(L9)、`VisualFX`(L763)、`AudioEngine`(L1038)、`CinematicEngine`(L1429)。
- 音频：WebAudio 合成，主音量 music/sfx/master 滑块；`dldl_audio_settings`、`dldl_audio_enabled`；mood 主题（'academy/main/title'），战斗回合计数。
- 开场 `CinematicEngine`：首次标记 / 直进标题 / 手动跳过（已验证）。

### 调研结论

| # | 发现 | 类型 | 影响 | 方向 |
|---|---|---|---|---|
| J1 | 粒子常驻（地图背景粒子）：地图一页持续跑粒子，低端/减少运动玩家卡顿 | 性能 | 中 | 按 `prefers-reduced-motion` 与「非前台标签页」暂停 |
| J2 | 音频文件是否存在未全量核对（`AudioFX` 的 WebAudio 合成不需要文件，但若使用实体音源需检查） | 数据 | 中 | `npm run validate:assets` 或人工遍历音效清单 |
| J3 | 特效/粒子/震幅数值无基准回归测试（图像敏感） | 测试 | 低 | 对 reduce-motion 最低档与无状态特效各做一次静态断言 |
| J4 | 开场跳过与序章跳过都已有真实浏览器验证 | 稳固 | - | - |

---

## K. 代码卫生与维护

### 代码位置（证据）

- 死代码：`renderStatusBar()`恒返回空串（renderStatusIcons 在旧版被移除）、`getDiscoveredLocations()`无调用、`reach_lv10.isComplete` 无读取。
- 硬编码联动：地点中文名/id、`RING_DESTINATIONS`、成就 id、NPC id 散落代码与 JSON，改一处需全局 grep。
- 测试：`tests/` 8 个文件（游戏数据完整性 13 JSON/508 稳定 id、事件冲突、combat-flow、accessibility、game-rules、save-utils、可视化回归）。
- `npm test`：跨轮次 17/17 → 29/29 → 44/44（随修复递增），`npm run validate:data` 通过。

### 调研结论

| # | 结论 | 类型 | 方向 |
|---|---|---|---|
| K1 | 三处死代码（K1）清理或接线 | K-1 | 删除 `renderStatusBar`/`getDiscoveredLocations` 或给 `reach_lv10.isComplete` 接主线状态卡 |
| K2 | **服务器存档 API 无鉴权**任意 playerId 可读/删/改，多标签页互相覆盖 | P1 | 引入游戏内 token/签名或至少双端校验；autosave 前比对「磁盘与内存差异」防止静默覆盖 |
| K3 | 双套 CSS（旧 `style.css` + `text-combat.css` + game.html 内联）易分叉 | 维护 | 收敛为单一主题 tokens 后并入口帧样式（参考 A 区建议抽 tokens.css） |
| K4 | 事件奖励字段 `hp` 兼容已统一 heal/damage/maxHp；`result.item`/effect 双字段已由 validate 检查 | 稳固 | - |
| K5 | 测试缺口：Lv.10+ 完整猎魂流程、最终 Boss、结局、服务器读写、真实存档回归、战斗数值（元素反应无自动测试） | 高 | 优先补上：①Lv.10 猎环回归 ②结局分支回归 ③服务端 save/load + 多标签 ④战斗数值矩阵 |

---

## 后续开发方向（按优先级）

### P0（马上做，破坏信任/丢失数据）

1. **服务器存档 API 鉴权 + 防静默覆盖**（C3/K2）：任何读取必须带会话身份；`autosave` 前检测磁盘内容指纹（saveHash）是否与服务器一致，不一致弹「你将覆盖云端进度，是否继续？」
2. **Lv.10 第一魂环全流程实测**（E2/G/D3）：无痕新档推进到 Lv.10，校验猎环→战斗→吸收成功→魂环&魂技名/属性一致；失败/Lagemina与吸收失败各验证一次。
3. **陈年事件地点映射全量扫**（F4/E6）：把 `EVENT_LOCATION_HINTS` 对 318 事件全跑一遍，产出「无法映射地点」清单，逐个归类或聚合成「地域池」。

### P1（直接影响可玩性）

4. **结局与终局 Boss 回归**（E4/D5/G5）：使用受保护的高等级存档走通 final_evil→结局，验证 `ENDING` 选择优先级解释；多条件结局时用户可预期。
5. **主线里程碑完成/接线**（E1）：接上 `MAIN_STORY_MILESTONES` 状态到主线卡，删除未被读取的死字段。
6. **统一地点数据单一来源**（F5/F1）：`map-data.json` 为权威，location-codex 与事件文本仅作中文展示层；新地点录入走一条校验流程。
7. **通知严格串行**与移动端长内容滚动验证（I-1/I-2）：完成「同一时间最多一条主通知」改造并在移动端验证图鉴/日记。

### P2（体验打磨）

8. **NPC 关系阶段内容**（H2）：每档好感增加 1 段专属事件/对话；UI 显示「下一档解锁内容」；结局好感上限对齐。
9. **战斗把握测算**（G2/G5）：经验与战斗数值差异矩阵；给自动战斗提供「进攻/均衡/稳妥」三档。
10. **帮助文本与实操对齐**（E7/I5）：帮助按阶段分类，删除或标注未实现系统；对「探索按钮」「地图点击移动」等难懂条目直接实现后引用。
11. **隐藏地点「发现→探索→再访」链路**（F3）。
12. **死代码清理 + CSS 收敛**（K1/K3）。

### 不做/可收缩

- 「事件数量」不宜继续无限加：优先让事件之间产生差异。
- 「随机遭遇权重/等级分布」「剧情分支全量展开」等设置级要素，除非用户确点需要。

---

## 验证计划（回归基线）

- 每次改动后：`npm test`、`npm run validate:data`、`node --check`（8 个关键 js）。
- 浏览器：Chrome 无痕 390×844 与 1920×1080 双开；关键路径（创建→觉醒→早年→首刷→第一猎魂`→Lv.10 魂环）无 console 错误与资源失败。
- 存档：新档、异形旧档（Lv.50/修复怪档）不被污染；服务器读写往返一次。

---

*本文档由 2026-08-03 调研整理，具体修复将按模块拆任务，并在 `docs/game-review-index.md` 对应条目更新状态。*