import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'public')
const readJson = file => JSON.parse(fs.readFileSync(path.join(publicDir, file), 'utf8'))
const mapData = readJson('data/map-data.json')
const codex = readJson('data/location-codex.json')
const errors = []
const locations = Array.isArray(mapData.locations) ? mapData.locations : []
const byId = new Map(locations.map(location => [location.id, location]))
const names = new Set(locations.map(location => location.name))
const codexNames = new Set((codex.locations || []).map(location => location.name))

function check(condition, message) {
  if (!condition) errors.push(message)
}

function neighbors(location) {
  const ids = new Set(Array.isArray(location?.connectedTo) ? location.connectedTo : [])
  for (const candidate of locations) {
    if (Array.isArray(candidate.connectedTo) && candidate.connectedTo.includes(location.id)) ids.add(candidate.id)
  }
  return [...ids].filter(id => byId.has(id))
}

function shortestRoute(startId, targetId) {
  if (!byId.has(startId) || !byId.has(targetId)) return []
  if (startId === targetId) return [startId]
  const queue = [startId]
  const previous = new Map([[startId, null]])
  while (queue.length) {
    const current = queue.shift()
    for (const next of neighbors(byId.get(current))) {
      if (previous.has(next)) continue
      previous.set(next, current)
      if (next === targetId) {
        const route = []
        let cursor = next
        while (cursor) {
          route.unshift(cursor)
          cursor = previous.get(cursor)
        }
        return route
      }
      queue.push(next)
    }
  }
  return []
}

check(locations.length > 0, 'map-data.json 没有地点')
check(new Set(locations.map(location => location.id)).size === locations.length, '地图地点 ID 重复')
for (const location of locations) {
  check(Number.isFinite(location.mapX) && location.mapX >= 4 && location.mapX <= 96, '地图 ' + location.id + ' 缺少有效 mapX')
  check(Number.isFinite(location.mapY) && location.mapY >= 6 && location.mapY <= 94, '地图 ' + location.id + ' 缺少有效 mapY')
  check(typeof location.landmarkType === 'string' && location.landmarkType.length > 0, '地图 ' + location.id + ' 缺少 landmarkType')
  for (const target of location.connectedTo || []) {
    check(byId.has(target), '地图 ' + location.id + ' 连接到不存在的节点 ' + target)
  }
  check(codexNames.has(location.name), '地图地点 ' + location.id + ' 缺少地点百科条目 ' + location.name)
}

const connected = new Set()
const visit = [locations[0]?.id].filter(Boolean)
while (visit.length) {
  const id = visit.shift()
  if (connected.has(id)) continue
  connected.add(id)
  visit.push(...neighbors(byId.get(id)).filter(next => !connected.has(next)))
}
check(connected.size === locations.length, '地图普通节点不在同一可达网络：' + locations.filter(location => !connected.has(location.id)).map(location => location.id).join(', '))

const ringSource = fs.readFileSync(path.join(root, 'frontend/src/utils/ring-hunt.js'), 'utf8')
const ringTargets = [...ringSource.matchAll(/\b(?:10|20|30|40|50|60|70|80|90):\s*\{\s*id:\s*'([^']+)'/g)].map(match => match[1])
check(ringTargets.length === 9, 'RING_DESTINATIONS 解析到 ' + ringTargets.length + ' 个目标，预期 9 个')
for (const targetId of ringTargets) {
  check(byId.has(targetId), 'RING_DESTINATIONS 目标 ' + targetId + ' 不存在于地图数据')
  check(shortestRoute('shrek_academy', targetId).length > 0, '猎魂目标 ' + targetId + ' 从史莱克学院不可达')
}
const seaRoute = shortestRoute('shrek_academy', 'sea_god_island')
check(seaRoute.includes('east_sea_port'), '海神岛路线没有经过东海港口：' + seaRoute.join(' -> '))

const mapHtml = fs.readFileSync(path.join(publicDir, 'map.html'), 'utf8')
const markerNames = [...mapHtml.matchAll(/\{id:'([^']+)'/g)].map(match => match[1])
for (const name of markerNames) check(names.has(name), 'public/map.html 硬编码节点 ' + name + ' 不存在于 map-data.json')
const keyBlock = mapHtml.match(/const LOCATION_KEYS = \{([\s\S]*?)\n\};/)
const keyValues = keyBlock ? [...keyBlock[1].matchAll(/'[^']+'\s*:\s*'([^']+)'/g)].map(match => match[1]) : []
check(keyValues.includes('east_sea_port'), 'public/map.html LOCATION_KEYS 缺少 east_sea_port')
check(keyValues.includes('sea_god_island'), 'public/map.html LOCATION_KEYS 缺少 sea_god_island')

const bridgeSource = fs.readFileSync(path.join(root, 'frontend/src/utils/mapBridge.js'), 'utf8')
const saveSource = fs.readFileSync(path.join(root, 'frontend/src/engine/save.js'), 'utf8')
const mapPageSource = fs.readFileSync(path.join(root, 'frontend/src/pages/MapPage.vue'), 'utf8')
const worldMapSource = fs.readFileSync(path.join(root, 'frontend/src/components/map/WorldMap.vue'), 'utf8')
check(bridgeSource.includes("'东海港口': 'east_sea_port'"), 'mapBridge 缺少东海港口别名')
check(saveSource.includes("'东海港口':'east_sea_port'"), '存档迁移缺少东海港口别名')
check(bridgeSource.includes('findShortestRoute'), 'mapBridge 缺少最短路线函数')
check(bridgeSource.includes('objectiveLocationId') && bridgeSource.includes('known:'), 'mapState 缺少活动目标可见性字段')
check(mapPageSource.includes("import WorldMap from '@/components/map/WorldMap.vue'"), '生产地图没有接入 Vue WorldMap 组件')
check(!mapPageSource.includes('<iframe'), '生产地图仍在使用 iframe')
check(!mapPageSource.includes('postMessage'), '生产地图仍在使用 postMessage 桥')
check(worldMapSource.includes('MapRouteLayer') && worldMapSource.includes('MapLocationMarker'), 'Vue 地图缺少路线层或地标组件')
check(worldMapSource.includes('/assets/map_bg_v2.webp'), '生产地图没有接入新版自绘底图')
check(fs.existsSync(path.join(publicDir, 'assets/map_bg_v2.webp')), '新版自绘地图底图不存在')

const explorationSource = fs.readFileSync(path.join(root, 'frontend/src/utils/location-exploration.js'), 'utf8')
check((explorationSource.match(/\{ id: '/g) || []).length >= 4, '地点探索阶段少于 4 个')
check(explorationSource.includes('buildLocationExplorationQueue'), '地点探索队列构建函数缺失')
check(explorationSource.includes('normalizeLocationExplorationState'), '地点探索存档归一化函数缺失')
check(explorationSource.includes('!event.ring') && explorationSource.includes('!event.mainStoryOnly'), '地点探索未排除正式猎魂或主线事件')

for (const entry of codex.locations || []) {
  if (!entry.image) continue
  check(fs.existsSync(path.join(publicDir, entry.image)), '百科图片不存在：' + entry.image)
}
check(fs.existsSync(path.join(publicDir, 'assets/locations/海神岛.jpg')), '海神岛图片不存在')
check(fs.existsSync(path.join(publicDir, 'assets/locations/天斗城.jpg')), '东海港口复用的图片不存在')

if (errors.length) {
  console.error('地图与地点探索审计失败，共 ' + errors.length + ' 项：')
  errors.forEach(error => console.error('- ' + error))
  process.exitCode = 1
} else {
  console.log('地图与地点探索审计通过：' + locations.length + ' 个节点、' + ringTargets.length + ' 个魂环目标、海神岛路线 ' + seaRoute.join(' -> '))
  console.log('生产地图：Vue 原生组件、无 iframe/postMessage；已接入新版自绘底图，地点坐标与地标类型均由 map-data.json 提供。')
  console.log('地点探索链结构：4 阶段；跨地区/主线/正式猎魂过滤与存档恢复由 frontend 单元测试覆盖。')
}
