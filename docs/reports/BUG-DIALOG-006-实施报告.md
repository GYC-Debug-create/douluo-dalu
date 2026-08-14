# BUG-DIALOG-006 实施报告：地图地点单一影响区

> 处理日期：2026-08-06。实施与独立审查均由 Codex 完成；最终状态只写入唯一 BUG 清单。

## 1. 已确认事实

- 玩家反馈为地图地点 hover 时淡圆、空心圈、填充点、图标和文字多层叠加并持续颤动。
- Vue 地图页实际通过 `frontend/src/pages/MapPage.vue` 内嵌 `public/map.html`；玩家看见的标记结构和动画全部位于后者。
- 修改前每个普通地点包含 `marker-hitarea / marker-glow / marker-ring / marker-dot / marker-icon / marker-label` 六层；`marker-glow` 无限脉动，`marker-ring` 无限旋转。
- 根节点 hover 从 `translate(-50%,-50%)` 变为 `scale(1.4)`，会改变真实命中边界；子点、图标和文字还会再次放大。
- 当前地图数据只有地点坐标和文本区域名，没有区域多边形几何；因此不能诚实实现真实行政边界描边。

## 2. 产品方案

采用“单一地点影响区”：地点根命中盒保持 60×60 且 hover/focus 永不缩放；删除常驻脉动 glow 与旋转 ring；只在 hover、键盘焦点或当前位置下显示一个椭圆影响区。影响区从 0.82 倍淡入到 1 倍，持续 180ms，不循环。点、图标和文字只改变亮度、阴影或颜色，不改变根布局。

相邻未访问地点使用静态虚线影响区，当前位置使用静态高亮影响区，雾区隐藏影响区。每个地点只保留根节点一个 `role=button/tabindex=0` 交互目标；文字点击继续通过事件冒泡进入同一详情逻辑。

旅行费用、连接关系、解锁等级、地图数据、详情面板、拖拽缩放和存档均不修改。

## 3. 修改文件

- `public/map.html`：标记 DOM 和交互样式。
- `tests/map-marker-ui.test.js`：新增 5 项静态回归。
- `frontend/browser-smoke.mjs`：新增真实 Chrome hover/focus/快速交替/响应式/reduced-motion 验收。
- `docs/local/bug-dialog-006/`：修改前后效果证据。
- 本报告与唯一 BUG 清单。

## 4. 自动化验收

单元测试验证：不再创建 `marker-glow/marker-ring`；不存在 `markerPulse/ringSpin`；根 hover 规则不含 scale；单一影响区没有 animation；普通地点只有一个键盘交互目标；雾区、相邻和当前位置存在静态降级。

真实 Chrome 验证：

- 地点子层为 `marker-hitarea/marker-focus/marker-dot/marker-icon/marker-label`；五层 animationName 全为 none。
- 1440 下 hover 前后根节点 x/y/width/height 每项差值不超过 1px；影响区 opacity 从 0 淡入 0.92。
- 在史莱克学院与星斗大森林外围之间快速交替 12 次，两个根命中盒始终稳定且没有启动动画。
- 1440、1024、768、390 四档键盘焦点均显示同一影响区，页面无横向滚动。
- reduced-motion 下所有地点子层 animationName 仍为 none。
- 详情点击、地图旅行等既有完整浏览器流程继续通过；页面错误、关键网络错误为 0。直开 legacy `map.html` 时 Chrome 会自行请求未配置的 `/favicon.ico`，烟测按精确 URL 排除该非产品资源，其余 404 不忽略。

## 5. 效果截图

- `bg006-before-1440-hover.png`：修改前整图同时存在大量脉动圆、旋转圈和点。
- `bg006-after-1440-hover.png`：普通点位安静，史莱克学院只显示单一椭圆影响区。
- `bg006-after-390-keyboard-focus.png`：窄屏键盘焦点与地图控件无横向裁切。

人工目视结论：修改后层级显著减少，地图底图与地点文字更容易辨认；hover 仍有明确反馈，但不再出现圈层持续扩散或根节点抖动。

## 6. 剩余风险

- 椭圆影响区表达“地点周边”而不是真实区域边界；若未来补充区域多边形数据，应另行升级为 SVG/Canvas 边界描边。
- 当前位置和相邻地点保持静态影响区以表达状态，地图点位极密集区域仍可能存在文字重叠；这属于信息密度问题，不属于本次 hover 颤动范围。
