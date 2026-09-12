const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const mapHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'legacy', 'map.html'), 'utf8')

test('BUG-ORAL-007 地点详情兼容字符串与数组形式的著名事件', () => {
  assert.match(mapHtml, /function detailTagList\(value\)/)
  assert.match(mapHtml, /const famousEvents = detailTagList\(data\.famousEvents\)/)
  assert.match(mapHtml, /escapeMapText\(e\)/)
  assert.doesNotMatch(mapHtml, /data\.famousEvents\.slice\(0,4\)\.map/)
})

test('BUG-DIALOG-006 地图地点使用单一影响区且不再创建多层动态光环', () => {
  assert.match(mapHtml, /focus\.className = 'marker-focus'/)
  assert.doesNotMatch(mapHtml, /className = 'marker-glow'/)
  assert.doesNotMatch(mapHtml, /className = 'marker-ring'/)
  assert.doesNotMatch(mapHtml, /@keyframes\s+markerPulse/)
  assert.doesNotMatch(mapHtml, /@keyframes\s+ringSpin/)
})

test('BUG-DIALOG-006 hover 与键盘焦点不缩放根命中盒', () => {
  assert.match(mapHtml, /\.location-marker:hover,\.location-marker:focus-visible\{z-index:10;transform:translate\(-50%,-50%\);\}/)
  const rootHoverBlock = mapHtml.match(/\.location-marker:hover,\.location-marker:focus-visible\{([^}]*)\}/)?.[1] || ''
  assert.doesNotMatch(rootHoverBlock, /scale\(/)
  assert.match(mapHtml, /\.location-marker:hover \.marker-focus,[\s\S]*?opacity:\.92;[\s\S]*?scale\(1\)/)
})

test('BUG-DIALOG-006 单一影响区只做一次短过渡且无无限动画', () => {
  const focusBlock = mapHtml.match(/\.marker-focus\{([\s\S]*?)\n\}/)?.[1] || ''
  assert.match(focusBlock, /transition:opacity \.18s ease-out,transform \.18s ease-out/)
  assert.doesNotMatch(focusBlock, /animation:/)
  assert.doesNotMatch(mapHtml, /\.marker-(?:focus|dot|icon|label)[^{]*\{[^}]*animation:/)
})

test('BUG-DIALOG-006 每个地点只有根节点一个键盘交互目标', () => {
  assert.match(mapHtml, /marker\.setAttribute\('role', 'button'\)/)
  assert.match(mapHtml, /marker\.setAttribute\('tabindex', '0'\)/)
  assert.doesNotMatch(mapHtml, /label\.setAttribute\('role', 'button'\)/)
  assert.doesNotMatch(mapHtml, /label\.setAttribute\('tabindex', '0'\)/)
})

test('BUG-DIALOG-006 雾区、相邻地点和当前位置具有明确静态降级', () => {
  assert.match(mapHtml, /\.location-marker\.fogged \.marker-focus\{display:none\}/)
  assert.match(mapHtml, /\.location-marker\.adjacent \.marker-focus\{opacity:\.28;border-style:dashed\}/)
  assert.match(mapHtml, /\.location-marker\.current \.marker-focus\{opacity:\.62/)
})
