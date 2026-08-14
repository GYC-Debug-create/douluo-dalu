import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVENTS, DYNAMIC_EVENTS, CHAINED_EVENTS } from '../frontend/src/data/game-data.js'
import '../frontend/src/data/events-expanded.js'
import { resolveAssetPath } from '../frontend/src/utils/asset-resolver.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = path.join(ROOT, 'public')
const ASSET_KEYS = new Set(['image', 'imagePath', 'imageUrl', 'icon', 'iconPath'])

async function readJson(relativePath) {
  return JSON.parse(await fs.readFile(path.join(ROOT, relativePath), 'utf8'))
}

function collectAssetRefs(value, refs, context, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectAssetRefs(item, refs, `${context}[${index}]`, seen))
    return
  }
  for (const [key, child] of Object.entries(value)) {
    const nextContext = `${context}.${key}`
    if (ASSET_KEYS.has(key) && typeof child === 'string' && child.trim().startsWith('assets/')) {
      refs.push({ raw: child.trim(), context: nextContext })
    }
    collectAssetRefs(child, refs, nextContext, seen)
  }
}

function normalizeSpiritEvent(source, spirit, eventKey) {
  return {
    ...source,
    id: source.id || `${eventKey}:${source.name || source.title || 'event'}`,
    name: source.name || source.title || '武魂专属事件',
    spiritId: spirit?.id || eventKey
  }
}

async function collectRecords() {
  const spiritEvents = await readJson('public/data/spirit-events.json')
  const codex = await readJson('public/data/spirit-codex.json')
  const spiritMap = await readJson('public/data/spirit-event-map.json')
  const spiritById = new Map((codex.spirits || []).map(spirit => [spirit.id, spirit]))
  const eventKeyToSpirit = new Map((spiritMap.mappings || []).map(item => [item.eventKey, item.spiritId]))
  const records = [
    ...EVENTS.map(event => ({ kind: '静态/扩展', event })),
    ...Object.values(DYNAMIC_EVENTS).map(event => ({ kind: '动态', event })),
    ...Object.values(CHAINED_EVENTS).map(event => ({ kind: '连锁', event }))
  ]
  for (const [eventKey, entries] of Object.entries(spiritEvents.spirit_events || {})) {
    const spiritId = eventKeyToSpirit.get(eventKey)
    const spirit = spiritById.get(spiritId)
    for (const source of entries || []) {
      records.push({
        kind: 'JSON武魂专属',
        event: normalizeSpiritEvent(source, spirit, eventKey)
      })
    }
  }
  return records
}

const records = await collectRecords()
const refs = []
records.forEach(({ kind, event }) => collectAssetRefs(event, refs, `${kind}:${event.id}`))
const uniqueRaw = [...new Set(refs.map(ref => ref.raw))]
const missing = []
const resolved = new Map()
for (const raw of uniqueRaw) {
  const asset = resolveAssetPath(raw)
  resolved.set(raw, asset)
  const absolute = path.resolve(PUBLIC_DIR, asset)
  const publicPrefix = `${path.resolve(PUBLIC_DIR)}${path.sep}`
  if (!absolute.startsWith(publicPrefix)) {
    missing.push({ raw, resolved: asset, reason: '资源路径越出 public' })
    continue
  }
  try {
    await fs.access(absolute)
  } catch {
    missing.push({ raw, resolved: asset, reason: '文件不存在' })
  }
}

const specialized = EVENTS.filter(event => event.locationActionType && (event.id.startsWith('east_port_') || event.id.startsWith('sea_island_')))
const specializedWithoutImage = specialized.filter(event => !event.image || !resolved.has(event.image))
console.log(`事件资源审计：${records.length} 个事件记录；${refs.length} 个引用；${uniqueRaw.length} 个唯一原始路径；缺失 ${missing.length}`)
console.log(`地点专属资源：${specialized.length} 条；无图片 ${specializedWithoutImage.length}`)
if (missing.length) {
  for (const item of missing) console.error(`缺失资源：${item.raw} -> ${item.resolved}（${item.reason}）`)
}
if (specialized.length < 16 || specializedWithoutImage.length) {
  console.error('地点专属事件资源检查失败：东海港口与海神岛必须各有完整图片事件。')
  process.exitCode = 1
}
if (missing.length) process.exitCode = 1
