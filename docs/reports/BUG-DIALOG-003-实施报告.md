# BUG-DIALOG-003 实施报告：神级保底未按出身/角色创建流程隔离

> 实施者：本轮实现会话
> 日期：2026-08-05
> 方案：任务书确认的方案 B（创建草稿内按出身 ID 隔离的保底计数，新键 `dldl_create_spirit_pity_v1`）
> 审查结论：本报告不写入 `ACCEPTED`，最终结论由 Codex 给出。

## 1. 实际修改文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `frontend/src/utils/creation-pity.js` | 新增 | 创建期神级保底的纯状态逻辑（存储模型、0~50 规范化、草稿生命周期、旧键清理、storage 安全包装） |
| `frontend/src/pages/CreatePage.vue` | 修改 | 出身卡保底角标、觉醒页保底文案、`doAwaken()`/`confirmSpirit()` 接入草稿计数；`dldl_god_spirit_pity`/`godPityCount` 全部移除 |
| `frontend/src/pages/TitlePage.vue` | 修改 | `startNew()` 先建立全新草稿（全出身归零）再进入创建页 |
| `frontend/tests/creation-pity.test.js` | 新增 | 20 项单测，覆盖任务书列出的全部单元验收点 |
| `frontend/browser-smoke.mjs` | 修改 | 末尾追加 BUG-DIALOG-003 独立验收段落（BUG-DIALOG-001/002 段落未做任何断言/截图改动，仅修复一处测试稳定性见 §15） |
| `docs/local/bug-dialog-003/*.png` | 新增 | 4 张浏览器验收截图（见 §12） |
| `docs/reports/BUG-DIALOG-003-实施报告.md` | 新增 | 本报告 |

未修改任何禁止文件（`serializer.js`、`player.js`、`useGameRules.js`、`game-data.js`、`public/game.js|html`、`server.js`、`package.json`、`package-lock.json`）；未新增依赖；未改动 BUG-DIALOG-001/002 的源码、测试段落与截图路径；未改动唯一 BUG 清单 `docs/reports/本对话BUG清单-武魂觉醒.md`；未提交、未推送。

## 2. 每个文件的修改目的

- **creation-pity.js（新增）**：把"保底计数"从页面内散落的全局键读写收敛为单一纯模块，独立可测。职责：键名与出身 ID 常量、计数规范化（0~50 整数）、草稿创建/读取/写入/清除、旧键删除、storage 读写抛错兜底。不接触任何抽取/属性/存档逻辑。
- **CreatePage.vue**：UI 与流程接入。出身卡横幅右下角新增紧凑角标「神级保底 17/50」；觉醒页主文案改为「星斗小村神级保底：1 / 50」（50 时金色解锁提示），其他出身仅在 >0 时显示紧凑行「其他出身：星斗小村 17/50」；`doAwaken()` 内"自然神级/手动自选 → 清零当前出身、非神级 → 当前出身 +1（50 封顶）"；`confirmSpirit()` 在 `saveToLocal()` 成功后才清除草稿（失败保留草稿并可重试）。`rollSpiritTier`、50 门槛、自选弹窗、抽取概率、先天魂力、存档结构一律未触碰。
- **TitlePage.vue**：`startNew()`（「新的旅程」）在跳转创建页前把草稿重置为四出身全 0 —— 这是"新角色不受上一角色保底影响"的生命周期入口；直接进入 `#/create` 时则由 `ensureDraft` 读取既有草稿（刷新保留语义）。
- **creation-pity.test.js（新增）**：数据驱动验证规范化、生命周期与旧键清理规则（见 §10）。
- **browser-smoke.mjs**：末尾追加 BUG-DIALOG-003 独立段落，真实 Chrome 完成全部浏览器验收点；BUG-DIALOG-001 段落输出与实施前完全一致（1920px 85.4%、1440px 84.3%），BUG-DIALOG-002 段落全部断言原样通过。

## 3. 真实根因

原实现把保底计数放在固定全局键 `dldl_god_spirit_pity`（单值整数），且进入创建页时直接读取该键：

- **跨出身共享**：星斗小村累计的计数在切换到武魂城世家后继续累加，四出身共用同一个计数器；
- **跨创建流程/跨角色共享**：上一角色的计数在新角色创建流程中直接继承（甚至跨刷新、跨浏览器存储持久保留），保底状态作用域过大；
- 该键同时被当作"全局开关"读取，导致保底状态泄漏到角色创建流程之外。

方案 B 修复方向：保底状态收敛为「当前角色创建草稿」（`draftId` 标识 + 四出身独立 `counts`），随「新的旅程」归零、随角色确认落盘清除，刷新仅保留草稿内的计数。

## 4. 存储模型（新键 `dldl_create_spirit_pity_v1`）

```json
{
  "version": 1,
  "draftId": "唯一草稿标识",
  "counts": {
    "star_forest": 17,
    "spirit_city": 1,
    "border_town": 0,
    "sea_island": 0
  },
  "updatedAt": 1730000000000
}
```

- 出身 ID 集合固定为 `game-data.js` ORIGINS 的四项（`star_forest/星斗小村`、`spirit_city/武魂城世家`、`border_town/边境小城`、`sea_island/海神岛渔村`），数据源只读，不硬编码新出身；
- 每次写入前 `normalizeCounts`：未知出身丢弃、缺失补 0、非整数取整、越界钳制到 **[0, 50]** 闭区间（负数→0、>50→50、NaN/Infinity/字符串数字→安全整数），**任何路径都不可能产生 51/50**；
- 读取时 `parseDraft`：损坏 JSON / 字段缺失 / version 不匹配 → 视为无草稿，安全回退为全 0 新草稿，不抛错；
- `safeStorageGet/Set/Remove`：localStorage 读写抛错（隐私模式/配额）全部 try/catch，创建流程不被保底存储阻断（`storage` 变量本身也以 try/catch 兜底为 null）。

## 5. 生命周期

| 时机 | 行为 |
|---|---|
| 标题页「新的旅程」 | `newJourneyDraft`：写入全新草稿（新 `draftId`，四出身全 0）→ 进入 `#/create` |
| 直接进入 `#/create`（刷新/直达） | `ensureDraft`：删除旧键 → 有草稿则读取（刷新保留计数），无草稿则创建全 0 草稿 |
| 觉醒成功（非神级） | 当前出身计数 +1（50 封顶） |
| 觉醒成功（自然神级 / 手动自选） | **仅**当前出身计数清零，其他三出身不变 |
| 切换出身（重新选择出身） | 各自计数独立恢复显示，互不干扰 |
| 确认角色 → `saveToLocal()` 成功 | `clearDraft` + `removeLegacyKey`：创建期保底草稿彻底清除 |
| `saveToLocal()` 抛错 | 保留草稿，可重试确认；不会出现"存档失败但保底丢失" |
| 从创建页离开（返回标题） | 草稿保留（与刷新语义一致，由下次读取兜底） |

## 6. 旧全局键 `dldl_god_spirit_pity` 的处理

- **不迁移、不复用**：旧键的单值整数无法拆回四出身，直接丢弃；
- 在读取新模型的统一入口 `ensureDraft()` 中执行 `removeLegacyKey`（懒清理）：任何一次进入创建流程后旧键即被删除；旧键存在与否不影响新计数；
- 浏览器烟测实证：预置 `dldl_god_spirit_pity = 49` → 点击「新的旅程」→ 断言旧键为 `null`、新草稿四出身全 0。

## 7. 50/50 解锁与封顶

- 非神级觉醒 +1，达到 **50/50** 时「自选神级武魂」按钮解锁（判定条件：`currentPity >= 50`）；
- 49/50 时按钮不可见（烟测断言）；
- 50/50 后继续普通觉醒仍保持 **50/50**，UI 与草稿均不出现 51/50（烟测用正则会话断言 `doesNotMatch(/51 \/ 50/)`，草稿计数断言等于 50）；
- 50 门槛、自选弹窗、神级池、抽取概率均为既有实现，未改动。

## 8. 两种神级清零规则

`doAwaken()` 三分支（与既有抽取流程完全对齐）：

| 分支 | 保底动作 |
|---|---|
| 手动自选神级（forcedSpirit） | 清零当前出身 |
| 空池回退（无可用自选/抽取异常回退非神级） | 当前出身 +1 |
| 自然神级（rollSpiritTier 返回 god） | 清零当前出身 |
| 其余（普通非神级） | 当前出身 +1 |

清零只作用于**当前选中出身**；烟测分别实证：星斗小村 17/50 + 武魂城世家 1/50 时自然神级 → 星斗 0、城 1 不变；星斗 2/50 + 城 49/50 时手动自选 → 城 0、星斗 2 不变。

## 9. 正式存档不含保底

- `serializer.js` 未修改，正式存档 JSON（`dldl_text_rpg_save`）不写入任何创建期保底字段；
- 烟测实证：确认角色后 `dldl_text_rpg_save` 顶层键不存在 `/pity|spirit_pity/i` 匹配项；草稿键 `dldl_create_spirit_pity_v1` 与旧键 `dldl_god_spirit_pity` 均已从 localStorage 清除；
- 存档版本号、云接口、迁移逻辑零改动。

## 10. 自动化测试命令、退出码和测试数量

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run validate:data` | 0 | 通过（13 个 JSON、9 个魂环事件；10 张 >1MB 大图告警为既有数据告警，非失败） |
| `npm run build` | 0 | 构建成功（新增 `creation-pity` chunk，2.31 kB / gzip 0.93 kB） |
| `npm test` | 0 | 根 node 测试 **53/53** + 前端 vitest **76/76**（实施前 56，新增 20） |
| `npm run test:browser` | 0 | 完整浏览器烟测通过（含构建） |

前端新增单测（`creation-pity.test.js`，20 项）覆盖：四出身默认全 0；`normalizeCount` 0~50 边界（0、50、51→50、-1→0、NaN/Infinity/字符串/小数/超大数）；未知出身忽略；缺失出身补 0；损坏 JSON / 非对象 / version 不匹配安全回退；`ensureDraft` 自动创建草稿（draftId 非空、version=1）；`newJourneyDraft` 全 0；`incrementOriginCount` 封顶 50；`isPityLimitReached` 仅 50 为真；`resetOriginCount` 清零且不影响其他出身；`clearDraft` 移除新键；`removeLegacyKey` 删除旧键；新旧键互不影响；storage 抛错不阻断；刷新读取保留原计数（17/1 场景）；未知出身不得进入 counts。

## 11. 浏览器验收结果（真实 Chrome headless，`npm run test:browser`）

全部通过，关键实测数值：

- **阶段 A**：预置旧键 49 → 「新的旅程」→ 旧键删除、新草稿四出身全 0；四张出身卡均显示「神级保底 0/50」；出身选择步 1920/1440/1024/768/390 五档视口 `scrollWidth == clientWidth` 无横向滚动。
- **阶段 B**：星斗小村固定随机（默认 0.5）连续觉醒 17 次 → 「星斗小村神级保底：17 / 50」，草稿 `star_forest: 17`，且 `spirit_city` 恒为 0（不串扰）。
- **阶段 C**：切到武魂城世家 → 从自己 0/50 开始，觉醒 1 次 → 「武魂城世家神级保底：1 / 50」+「其他出身：星斗小村 17/50」；切回星斗小村恢复 17/50，城保留 1/50；草稿 `{star_forest:17, spirit_city:1, border_town:0, sea_island:0}`。
- **阶段 D**：刷新页面 → 17/50 与 1/50 均保留（只恢复保底，不恢复姓名/步骤/武魂）。
- **阶段 E**：返回标题再点「新的旅程」→ 四出身全部归零。
- **阶段 F**：预置 `star_forest: 48` → 觉醒 → 49/50（自选按钮不可见）→ 再觉醒 → 50/50（自选按钮解锁）→ 继续觉醒仍 50/50（无 51/50，草稿封顶 50）；觉醒步五档视口无横向滚动。
- **阶段 G**：自然神级（固定随机 0.995）→ 星斗清零、城 1/50 不变；预置 `star_forest:2, spirit_city:49` → 城到 50/50 → 手动自选神级 → 城清零、星斗 2/50 不变。
- **阶段 H**：确认角色（自选验收）→ `#/game` 序章事件 → 草稿键与旧键均已清除，`dldl_text_rpg_save` 无保底字段、`name='自选验收'`。
- **零错误**：BUG-003 独立上下文 0 条 console error / pageerror / 请求失败 / ≥400 响应；主流程 `runtimeErrors` 断言通过。
- **零回归**：BUG-DIALOG-001 布局输出与实施前完全一致（1920px 85.4%、1440px 84.3%）；BUG-DIALOG-002 全部断言通过（re-entry 左右交集 0、reduced-motion 交集 0、1920/1440 discErr=0.00px、窄屏无横滚、spiritRequests=20）。

## 12. 浏览器截图的完整路径

全部保存于 `docs/local/bug-dialog-003/`：

1. `bg003-b-390-origin-cards.png` —— 390px 出身选择（四卡带「神级保底 x/50」角标）
2. `bg003-b-1920-per-origin.png` —— 1920px 武魂城世家 1/50 + 「其他出身：星斗小村 17/50」
3. `bg003-b-1920-refresh.png` —— 1920px 刷新后星斗 17/50、城 1/50 保留
4. `bg003-b-1920-limit-50.png` —— 1920px 50/50 封顶 + 自选神级武魂按钮解锁

## 13. 真实游玩验收结果

在真实 Chrome（headless）完成完整创建 → 觉醒 → 确认 → 进入游戏 → 序章剧情链路：

- 主流程回归（既有烟测）：建角 → 觉醒 → 确认 → 剧情 → 商店 → 地图旅行 → 图鉴 → 继续冒险 → 签到 → 刷新恢复，全部通过；
- BUG-003 流程：新旅程 → 星斗 17 次觉醒 → 切城觉醒 → 刷新 → 新旅程归零 → 50 封顶解锁 → 自然神级清零 → 手动自选清零 → 确认落盘后草稿清除，全部通过（UI 觉醒点击合计 24 次，与计数期望完全一致：17+1+1+1+1+1+1+1）。

## 14. 控制台和网络错误情况

- 全程 0 条 console error、0 条 pageerror、0 条 document/script/stylesheet/xhr/fetch 请求失败或 ≥400 响应（BUG-003 上下文与主流程均断言）；
- 出身卡角标、觉醒页文案均为纯文本渲染，无新图片资源、无新网络请求、无新依赖。

## 15. 测试稳定性修复说明（不改产品行为的烟测维护）

实现过程中浏览器烟测曾卡死在主流程「开始觉醒」点击（`element is not stable`，30s 超时）。定位与处理：

1. **根因**：初始把保底角标做成出身卡 body 内的块级元素，出身卡增高约 24px，使 Playwright 上一步点击后停驻的鼠标恰好落在「开始觉醒」按钮的 hover 触发边界上；`.btn:hover { translateY(-2px) }` 与 `transition: all` 在 headless 下形成永不收敛的 hover 振荡（实测 4s 内 translateY 在 -1.52~-1.87px 往复），Playwright 的稳定性检查（连续两帧零位移）永远无法满足。
2. **修复（产品侧，0 布局变化）**：把角标改为 `.oc-banner` 内的绝对定位元素（`position: absolute; right/bottom`，z-index 2，`pointer-events: none`），出身卡整体布局与实施前逐像素一致，主流程停驻几何恢复原状，未改任何 `.btn` 或既有 CSS。
3. **修复（烟测侧）**：BUG-003 段落内所有点击经 `bg003Click` 包装（先 `mouse.move(0,0)` 再点击），杜绝停驻悬停类偶发；阶段 F/G3 预置草稿后改用 `page.reload()` 而非 `goto(#/create)`（同 hash 的 goto 不触发重载，草稿与页面步骤会不一致）。
4. 未修改 BUG-DIALOG-001/002 段落的任何断言与截图路径；两段输出与实施前逐字符一致。

## 16. 未完成项和剩余风险

- **人工目视复核**：本实施会话的模型不支持图像输入，出身卡角标（横幅右下角、黑底金字带细边框）与觉醒页文案的观感请人工打开 `docs/local/bug-dialog-003/` 复核；
- 旧键懒清理语义：用户若从未进入创建页，旧键不会主动删除（删除发生在进入创建流程/「新的旅程」时），属预期；
- 保底草稿在返回标题后保留（与刷新语义一致），下次「继续冒险」读正式存档不受其影响（正式存档不读草稿）；
- `dist/` 随任务书要求的 build/smoke 命令重新生成，未提交、未手工修改。

## 17. 实施前后差异说明

| 维度 | 实施前 | 实施后 |
|---|---|---|
| 存储 | 固定全局键 `dldl_god_spirit_pity` 单整数 | 创建草稿 `dldl_create_spirit_pity_v1`（draftId + 四出身 counts + version + updatedAt），旧键读取时删除 |
| 作用域 | 跨出身、跨创建流程、跨角色共享 | 仅当前创建草稿内；「新的旅程」全归零；确认落盘后清除 |
| 出身隔离 | 无 | 星斗/武魂城世家/边境/海神岛各自 0~50 独立计数，互不串扰 |
| 边界 | 无封顶保证 | 0~50 整数规范化钳制，任何路径无 51/50 |
| 神级清零 | 全局重置 | 仅清零当前出身，其他出身保留 |
| UI | 无出身卡提示 | 出身卡角标「神级保底 17/50」（0 也显示）；觉醒页「星斗小村神级保底：1 / 50」+「其他出身：星斗小村 17/50」 |
| 存档 | — | 正式存档零保底字段；`saveToLocal` 成功才清草稿 |
| 抽取/概率/属性 | — | `rollSpiritTier`、50 门槛、自选弹窗、神级池、先天魂力零改动 |
| BUG-001/002 | — | 零改动，输出与实施前一致 |

---

# R2 修复记录（Codex 审查 CHANGES_REQUESTED 后的修复）

> 本轮仅修复 R1 审查发现的问题，未重构任何已通过的保底业务逻辑，未修改 `CreatePage.vue`、`TitlePage.vue`、`serializer.js`、抽取概率或 UI 布局。

## R2-1. Codex R1 审查发现的三个问题（原样转述）

1. **历史截图被反复覆盖**：`browser-smoke.mjs` 每次运行都会用 `page.screenshot()` 覆写 BUG-DIALOG-001、002、003 的既有截图，历史证据文件内容被替换。
2. **截图时机错误**：截图在 `.awaken-left` 的延迟动画（`descReveal 0.8s ease-out 1s both`，opacity 0→1、translateY 15px→0）完成前拍摄，导致截图中保底计数不可见（`innerText` 在 opacity 0 时即存在，仅查 innerText 无法保证可见）。
3. **损坏草稿校验不足**：`parseDraft()` 对缺少 draftId / counts / updatedAt 等关键字段的草稿不拒绝（用空串/0 修补后照常返回），`writeDraft()` 可写出空 draftId，`ensureDraft()` 会继承损坏草稿中的计数。

## R2-2. R1 确实在 15:34～15:35 覆盖了 BUG-001/002 历史截图

R2 实施前（任何修改前）先对三个截图目录全部既有文件记录 SHA256、LastWriteTime、Length（共 18 个文件），实测时间戳：

- **BUG-DIALOG-001（5 个）**：`b-1024-event.png` 等文件 CreationTime 为 2026-08-04 20:42~20:45（原验收会话），但 LastWriteTime 全部变为 **2026-08-05 15:34:27~15:34:29**；
- **BUG-DIALOG-002（9 个）**：CreationTime 为 2026-08-05 00:07~00:35（原验收会话），但其中 8 个 LastWriteTime 变为 **2026-08-05 15:34:38~15:35:16**；
- **BUG-DIALOG-003（4 个）**：R1 首轮创建于 15:32:40~15:33:04，随后在 R1 第二次烟测运行中全部被覆写：`bg003-b-390-origin-cards.png` 15:32:40→**15:35:19**、`bg003-b-1920-per-origin.png` 15:33:02→**15:35:41**、`bg003-b-1920-refresh.png` 15:33:04→**15:35:43**、`bg003-b-1920-limit-50.png` **15:35:48**（创建即覆写）。

即：R1 期间两次完整 `npm run test:browser`（15:34~15:35）用相同路径把 BUG-001/002/003 的历史截图全部覆盖重写。

## R2-3. 原报告"未覆盖"结论为什么错误

R1 报告 §15 的表述是"未修改 BUG-DIALOG-001/002 段落的任何断言与截图路径；两段输出与实施前逐字符一致"。这句话在**代码层面**成立（断言、流程、指标、截图路径字符串均未改），但审查指出它隐含且实质错误的推论是"历史截图未受影响"：**"未修改代码中的截图路径"≠"磁盘上的截图文件未被覆盖"**。`page.screenshot({ path: 同路径 })` 每次运行都会覆写目标文件；R1 两次完整烟测使 001/002/003 全部 17 张既有截图被同路径重写。原报告没有检查过运行前后文件哈希/时间戳，因此"未覆盖"结论错误。

## R2-4. 历史截图无法验证恢复，不得声称已恢复

R1 覆写前各截图的原始像素内容未在任何位置留有副本（无备份文件、无 diff、无 git 记录——项目目录未纳入版本控制）。当前磁盘上的文件内容即为 R1 覆写后的版本，无法确认与原始内容是否一致，**本报告不声称已恢复历史截图**。R2 能做的只是：以"只写一次"机制阻止继续覆盖，并给出本次运行前后的哈希/时间/长度对比作为"R2 未再触碰任何既有文件"的证据。

## R2-5. 新的"只写一次"截图保护机制

`browser-smoke.mjs` 新增统一辅助函数：

```js
const screenshotOnce = async (pageOrLocator, filePath) => {
  if (fs.existsSync(filePath)) {
    console.log(`截图已存在，跳过写入（只写一次保护）: ${path.basename(filePath)}`)
    return false
  }
  await pageOrLocator.screenshot({ path: filePath, fullPage: false })
  return true
}
```

- 目标文件不存在：允许创建；目标文件已存在：跳过写入（打印跳过日志），**绝不先覆盖再恢复、绝不删除/移动/重命名旧截图**；
- 全部 17 处既有截图调用已机械接入（BUG-001 共 5 处、BUG-002 共 8 处、BUG-003 共 4 处），只改变写入方式，未改动任何断言、流程、指标、截图路径；
- R2 证据使用全新文件名 `bg003-r2-b-1920-per-origin.png`、`bg003-r2-b-1920-limit-50.png`，同样经 `screenshotOnce` 写入（本次创建，后续运行同样只写一次）。

## R2-6. 完整烟测前后的旧证据哈希对比

`npm run test:browser` 运行前、后各记录一次三个目录全部文件的 SHA256、LastWriteTime、Length（记录文件保存在会话临时目录 `C:\Temp\opencode\bg003-r2-baseline-{before,after}.txt`）：

| 指标 | 结果 |
|---|---|
| 既有截图总数（001 5 + 002 9 + 003 4） | 18 |
| 运行前后发生变化的文件 | **0**（18/18 的 SHA256、LastWriteTime、Length 完全一致） |
| 新增文件 | **2**（仅两张 R2 截图） |
| 烟测日志中"跳过写入" | 17 条（全部既有截图） |

运行前后完全一致、唯一新增为两张 R2 截图的结论成立。既有 18 个文件在 R2 前后的 SHA256 逐项对比全部相同（示例：`b-1920-event.png` 3CC2ACED…、`bg002-1920-carousel.png` F3E141FB…、`bg003-b-1920-refresh.png` FD5463F2… 等，完整对照见上述临时记录文件）。

## R2-7. 两张 R2 截图路径

- `docs/local/bug-dialog-003/bg003-r2-b-1920-per-origin.png`（SHA256 `9F3BAF928FF4BD9347EACE193A0FD41FAE0A7178B88CD42EAC8BB5427FFDCD64`，542284 字节）
- `docs/local/bug-dialog-003/bg003-r2-b-1920-limit-50.png`（SHA256 `818DA3D94A8F30D236354E622B300D5B434216607BBDBA5FAA0CB391F6710A0A`，550793 字节）

## R2-8. 两张图中实际可见的保底文字

截图前同时等待：`.awaken-left` 存在且可见（Playwright 判定）→ `innerText` 含预期计数 → `getComputedStyle().opacity >= 0.95` → 非零宽高 → 连续三个动画帧位置与透明度稳定（±0.5px / ±0.02）。全程未强制修改 CSS、未禁用动画、未改动 DOM。截图时刻的 DOM 级渲染状态（烟测日志原样）：

- **per-origin**：`opacity=0.975283 rect=1500x76.5@210,807.6`，文本为 `可无限次重新觉醒 / 武魂城世家神级保底：1 / 50 / 其他出身：星斗小村 17/50`；
- **limit-50**：`opacity=0.972485 rect=1500x76.5@210,807.6`，文本为 `可无限次重新觉醒 / 星斗小村神级保底：50 / 50 / ? 神级保底已解锁，可自行选择一个神级武魂！`，且「自选神级武魂」按钮 `waitFor visible` 通过、`innerText` 断言不含 `51 / 50`。

即：R2 per-origin 图清楚显示「武魂城世家神级保底：1 / 50」与「其他出身：星斗小村 17/50」；R2 limit 图清楚显示「星斗小村神级保底：50 / 50」、解锁提示与自选按钮、无 51/50。**人工/图像工具目视复核仍待 Codex/人工执行**（本会话模型不支持图像输入，已提供截图文件与上述 DOM 证据供对照）。

## R2-9. 损坏草稿校验修复（`creation-pity.js`，仅放宽/收紧校验，业务规则未变）

1. `parseDraft()` 严格拒绝并返回 null：缺少 draftId / draftId 非字符串 / 空或纯空白 draftId；缺少 counts / counts 非普通对象（null、数组、字符串、数字均拒绝）；缺少 updatedAt / updatedAt 非有限数字（NaN、Infinity、非数字字符串、null 拒绝）；version !== 1；
2. 合法 draftId 读取时执行 trim（正常生成的 ID 无首尾空白，不受影响）；
3. `writeDraft()` 不再写出空 draftId：输入 ID 缺失/空白时自动生成新的非空唯一 ID，保留已规范化的合法出身计数，写入结果保证可被 `parseDraft()` 重新读取；
4. `ensureDraft()` 遇到损坏草稿：视为不存在，建立全新全 0 草稿（新 draftId），不继承损坏对象中的任何计数，不抛错；
5. 正常草稿、刷新保留、出身隔离、50 封顶逻辑零改动。

## R2-10. 新增测试数量与四条命令结果

- 前端新增 11 项损坏草稿校验单测（`creation-pity.test.js` 新增 describe 块），覆盖：缺 draftId / 空 draftId / 纯空白 draftId / 非字符串 draftId；缺 counts / counts 为 null、数组、字符串、数字；缺 updatedAt / updatedAt 为 NaN、Infinity、非数字字符串、null；draftId 读取 trim 且不影响正常 ID；writeDraft 空 ID 写出新非空唯一 ID 且保留计数；writeDraft 结果可被 parseDraft 重读；ensureDraft 遇缺字段草稿建立全 0 新草稿、不继承旧计数、不抛错；
- 前端既有 20 项全部继续通过（其中 1 项旧夹具补了缺失的 `updatedAt` 字段以符合新校验语义），前端总计 **87/87**；
- 根 node 测试 **53/53**；
- 命令结果：`npm run validate:data` **0**、`npm run build` **0**、`npm test` **0**、`npm run test:browser` **0**；
- 烟测关键指标无回归：BUG-DIALOG-001 布局输出与实施前逐字符一致（1920px 85.4%、1440px 84.3%）；BUG-DIALOG-002 指标一致（discErr=0.00px、spiritRequests=20、re-entry/reduced-motion 交集 0）；BUG-DIALOG-003 核心流程一致（UI觉醒次数=24、确认后草稿清除、正式存档无保底字段）；控制台与关键网络错误 0 条；17 张旧截图全部"跳过写入"、2 张 R2 截图新建。

## R2-11. 剩余风险

- 历史截图 R1 覆盖前的原始内容不可恢复（无备份）；R2 已通过"只写一次"阻止继续覆盖，并以运行前后哈希/时间/长度对比为证；
- R2 截图文字可见性已由 DOM 级状态（opacity、宽高、innerText）与文件哈希背书，最终像素观感仍需人工/图像工具目视确认；
- 未提交、未推送、未修改 BUG 清单状态与 memory 文件；`dist/` 由命令重新生成。

本报告不写入 `ACCEPTED`，最终结论仍由 Codex 给出。


---

## R3 编码修复记录

- 原文件 R1 章节为 UTF-8，R2 章节误以 GBK/CP936 追加，导致整份报告为混合编码；
- 本轮仅将整份报告统一为单一 UTF-8（无 BOM），未修改任何代码、测试、截图、产品行为或 BUG 清单；
- R1 期间历史截图确实被覆盖（详见 R2-2），本轮未声称恢复历史截图，也未修改任何截图文件；
- 最终 ACCEPTED 仍由 Codex 给出。
