# BUG-DIALOG-001 实施报告

> 项目：斗罗大陆·武魂觉醒
> 范围：仅 BUG-DIALOG-001（主游戏剧情内容区过窄，宽屏空白过多）
> 方案：方案 B —— 流体铺宽单栏（已确认产品方向）
> 日期：2026-08-04

## 一、问题与方案

- 现象：左侧 290px 状态栏 + 1fr 主区域；剧情容器被固定为 `max-width: 680px`，1920px 视口下主区域约 1630px，剧情区仅 680px，利用率约 41.7%，宽屏右侧大量空白。
- 根因：`frontend/src/components/SceneArea.vue` 中 `.scene-event / .scene-continue / .scene-ending` 的统一 680px 上限，而非主网格。
- 目标：宽屏下标题、正文、图片、选项充分利用主区域；保持单栏纵向、标题左对齐、暗金视觉风格；不双栏、不加卡片边框、不新增装饰；不改任何规则/事件/存档。

## 二、实际修改

### 1. `frontend/src/components/SceneArea.vue`（唯一产品代码修改）

```diff
 .scene-event,
 .scene-continue,
 .scene-ending {
-  max-width: 680px;
+  width: 100%;
+  max-width: none;
   margin: 0 auto;
 }
 
+@media (min-width: 1200px) {
+  .scene-event,
+  .scene-continue,
+  .scene-ending {
+    width: 88%;
+    max-width: 1600px;
+  }
+}
+
 .scene-img {
   width: 100%;
-  max-height: 280px;
+  aspect-ratio: 12 / 5;
+  max-height: min(52vh, 580px);
   object-fit: cover;
   border-radius: 6px;
   margin-bottom: 16px;
   border: 1px solid var(--line);
 }
```

要点：
- 默认 `width: 100%` 铺满场景内容区（扣场景左右 padding 后），`margin: 0 auto` 水平居中；1200px 及以上取内容区 88%，上限 1600px。
- 图片改 12/5 横幅裁切方向（与原来约 680×280 一致），超宽屏高度上限 `min(52vh, 580px)`，保持 `object-fit: cover` 居中构图、无拉伸；加载失败仍走 `onImgError` 隐藏。
- `.scene-battle`（900px）、`.scene-idle-inner`（480px）、标题/正文/选项样式均未改动。
- `GamePage.vue` 未修改（无必要）。

### 2. `frontend/browser-smoke.mjs`（自动化验收）

- 新增 BUG-DIALOG-001 布局断言段（事件态 5 档视口 1920×1080 / 1440×1000 / 1024×768 / 768×900 / 390×844）：
  - 1920 下剧情容器占主区域 82%～88%；1440 下 80%～88%；
  - 1024 下基本占满 `.scene-area` 扣除 padding 后的空间（fill ≥ 98%）且不得明显窄于原 680px；
  - 所有视口左右留白对称（差 ≤ 2px）、`body.scrollWidth` 不超视口、标题/正文/选项全部落在容器内、选项纵向排列、至少一个可点击；
  - 1920 下校验真实事件图片：自然尺寸非零、`object-fit: cover`、渲染宽度跟随剧情容器、无拉伸；
  - `.scene-continue` 与 `.scene-event` 同一宽度规则一致性（1920 下 ±2px）、继续前行/地图按钮可用；
  - 断言读取真实 DOM 边界与 computed style（非 CSS 字符串匹配）。
- 新增 `settleLayout()`（鼠标移开 + 宽度稳定轮询 + 300ms），消除 `.choice-btn` 的 `transition: all 0.2s` 与残留 hover 导致的过渡期误测。
- 原事件链、商店、地图旅行、签到、刷新恢复流程保持不变。

### 3. 新增截图证据（仅 PNG）

`docs/local/bug-dialog-001/`（真实 Chrome 渲染，非生成图）：
- `b-1920-event.png`
- `b-1440-event.png`
- `b-1024-event.png`
- `b-390-event.png`
- `b-1920-continue.png`

## 三、布局测量结果

| viewport | main-area | scene-area | scene-event | event/main | event/内容区 | 左右间距差 | body.scrollWidth | 通过 |
|---|---|---|---|---|---|---|---|---|
| 1920×1080 | 1630 | 1630 | 1392.2 | 85.4% | 88.0% | 118.9/118.9 → 0 | 1920 | ✔ |
| 1440×1000 | 1150 | 1150 | 969.8 | 84.3% | 88.0% | 90.1/90.1 → 0 | 1440 | ✔ |
| 1024×768 | 734 | 734 | 686 | 93.5% | 100.0% | 24/24 → 0 | 1024 | ✔ |
| 768×900 | 768（单列） | 768 | 720 | 93.8% | 100.0% | 24/24 → 0 | 768 | ✔ |
| 390×844 | 390（单列） | 390 | 342 | 87.7% | 100.0% | 24/24 → 0 | 390 | ✔ |

图片（序章 forest_outer.jpg，自然 2240×1680=4:3）：1920 下渲染 1392.2×561.6（12/5 横幅、<580px 上限）、`object-fit: cover`、宽度=容器宽度、无拉伸。

## 四、测试结果

| 命令 | 结果 | 数量 |
|---|---|---|
| `npm run build` | 通过 | vite 构建 82 modules |
| `npm test --prefix frontend` | 通过 | 6 文件 45/45 |
| `npm test`（含 pretest build） | 通过 | node 53/53 + 前端 45/45 |
| `npm run test:browser` | 通过 | 全流程 smoke 通过，运行时错误 0 |

开发中记录的两次失败均属测试自身问题（一次我写坏的反引号语法；一次 1024 档被按钮过渡动画误测），修复后全绿，产品代码未受影响。

## 五、浏览器实际结果

- 新建角色 ✔；剧情事件正常显示，标题左对齐、正文缩进/行高/暗金风格不变 ✔
- 图片正常、横幅裁切、无拉伸、无横向溢出 ✔
- 选项可点击；结果页与事件页宽度一致（1920 下 1392.2px，误差 0）✔
- “继续前行”正常推进；后续商店/地图旅行/签到/刷新恢复全部正常 ✔
- 5 档视口无 body 横向溢出；顶部菜单、左侧状态栏、通知、弹窗未受影响 ✔
- console/pageerror/requestfailed：0 ✔
- 注：本模型无法直接目检 PNG，截图几何正确性由 DOM 断言保证，供审查员人工查看。

## 六、范围声明

- 未修改 BUG-DIALOG-002～015，未修改 BUG 清单文件。
- 未改事件文本/选项/条件/奖励、玩家状态、`dldl_text_rpg_save` 契约（无新存档字段、无状态迁移）。
- 未改战斗/空闲场景、状态栏、地图/图鉴、`GamePage.vue`、stores、composables、`server.js`、`package.json`、`public/data/`、其他页面/组件/测试。
- 未删除/移动现有文件；未 commit / push / 建分支。
- 修改文件 SHA256（修改前 → 后）：SceneArea.vue `CB07F48C…` → `CF8240CB572F2BDB8C27F60E5247F851B5A8B3B545A102AB63999D2807C1C139`；browser-smoke.mjs `B90D3DB3…` → `1E8673F99C0F5E57BE763E136E39EE880897A1D51A78941D62633D3AC5EFF670`。

## 七、剩余风险

- 1200px 临界视口未单独测试（1024/1440 已覆盖两侧）。
- `.scene-ending` 与 event/continue 共用同一规则但流程不可达，未直接测量。
- 极长条件提示在 390px 下的极端文案未覆盖。
- 缺图事件（古道残碑/tian_dou_city.jpg）行为不变：加载失败隐藏、不占位。
- 未修改 BUG 清单状态，未宣称 ACCEPTED，等待最终审查员复核。
