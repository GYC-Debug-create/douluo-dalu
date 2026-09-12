#!/usr/bin/env node
/**
 * 存档列表基准（阶段二 2.2 验收）
 *
 * 对比"全量解析"（旧 loadPlayerList：每次列表刷新都 JSON.parse 全部存档）
 * 与"mtime/size 增量索引"（新实现：未变更文件只做 stat，O(1) 复用摘要）。
 *
 * 用法：node scripts/bench-player-list.mjs [存档数量=100] [轮次=5]
 * 脚本在系统临时目录生成隔离数据集，不触碰仓库 data/ 目录。
 */
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const count = Number(process.argv[2]) || 100
const rounds = Math.max(1, Number(process.argv[3]) || 5)

const dataDir = mkdtempSync(join(tmpdir(), 'douluo-bench-'))
process.env.DATA_DIR = dataDir
// 在 DATA_DIR 生效后再加载服务器模块
const require = createRequire(import.meta.url)
const { loadPlayerList, invalidatePlayerListCache } = require('../server.js')

function makeSave(index) {
  return {
    playerId: `bench_${String(index).padStart(4, '0')}`,
    name: `基准存档${index}`,
    gameMode: 'text-rpg',
    spirit: { id: 'bench_spirit', name: '基准武魂', tier: 'mid', type: '强攻系' },
    level: 1 + (index % 99),
    gold: 100 + index,
    lastSave: new Date().toISOString(),
    _serverVersion: index,
    owner: 'bench',
    // 模拟真实存档体积：填充约 2KB 的字段
    inventory: Array.from({ length: 24 }, (_, i) => ({ name: `物品${i}`, type: 'heal', value: 10, count: 1 })),
    diary: Array.from({ length: 16 }, (_, i) => ({ turn: i, level: i, text: '历练记录'.repeat(8) }))
  }
}

const files = []
for (let i = 0; i < count; i++) {
  const fileName = `player_bench_${String(i).padStart(4, '0')}.json`
  writeFileSync(join(dataDir, fileName), JSON.stringify(makeSave(i)), 'utf8')
  files.push(fileName)
}

async function timed(label, fn, reset = null) {
  const samples = []
  let result
  for (let i = 0; i < rounds; i++) {
    if (reset) reset() // 每轮前失效缓存，避免 TTL 命中污染测量
    const start = process.hrtime.bigint()
    result = await fn()
    samples.push(Number(process.hrtime.bigint() - start) / 1e6)
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length
  const min = Math.min(...samples)
  console.log(`${label.padEnd(38)} 平均 ${avg.toFixed(2).padStart(8)}ms  最快 ${min.toFixed(2).padStart(8)}ms`)
  return { result, avg }
}

// 旧实现基线：每次全量读 + 解析所有存档
function oldStyleLoad() {
  const list = []
  for (const fileName of files) {
    const data = JSON.parse(readFileSync(join(dataDir, fileName), 'utf8'))
    if (data.gameMode !== 'text-rpg' && !(data.spirit && typeof data.spirit === 'object')) continue
    list.push({
      playerId: data.playerId, name: data.name, level: data.level,
      spirit: data.spirit, gameMode: data.gameMode, lastSave: data.lastSave,
      version: data._serverVersion, owner: data.owner
    })
  }
  return list
}

try {
  console.log(`\n存档数量: ${count}  ·  测量轮次: ${rounds}\n`)

  await timed('旧实现：全量读盘+解析', oldStyleLoad)

  // 冷启动只测一次：首跑无索引文件，需全量解析并落盘索引
  invalidatePlayerListCache()
  {
    const start = process.hrtime.bigint()
    const cold = await loadPlayerList()
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    console.log(`${'新实现·冷启动（无索引，全量重建）'.padEnd(38)} 单次 ${ms.toFixed(2).padStart(8)}ms  共 ${cold.list.length} 条`)
  }

  await timed('新实现·热（无变更，纯 stat 命中）', async () => (await loadPlayerList()).list, invalidatePlayerListCache)
    .then(out => {
      if (out.result.length !== count) throw new Error(`热轮次返回 ${out.result.length} 条，期望 ${count}`)
    })

  // 改动一个存档（玩家保存一次的最常见场景）
  const changedFile = files[Math.floor(count / 2)]
  const changed = JSON.parse(readFileSync(join(dataDir, changedFile), 'utf8'))
  changed.level = 99
  changed.lastSave = new Date().toISOString()
  writeFileSync(join(dataDir, changedFile), JSON.stringify(changed), 'utf8')
  utimesSync(join(dataDir, changedFile), new Date(), new Date())

  const delta = await timed('新实现·单档变更（仅重析 1 个）', async () => (await loadPlayerList()).list, invalidatePlayerListCache)
  const changedEntry = delta.result.find(entry => entry.playerId === changed.playerId)
  if (!changedEntry || changedEntry.level !== 99) throw new Error('变更存档未被重新解析，增量索引失效')

  // 一致性抽查：新旧实现的列表字段必须一致
  const fresh = oldStyleLoad()
  invalidatePlayerListCache()
  const viaIndex = (await loadPlayerList()).list
  const pick = entry => JSON.stringify({ ...entry, lastSave: undefined })
  const same = fresh.length === viaIndex.length &&
    [...fresh].sort((a, b) => a.playerId.localeCompare(b.playerId)).every((entry, i) =>
      pick(entry) === pick([...viaIndex].sort((a, b) => a.playerId.localeCompare(b.playerId))[i]))
  if (!same) throw new Error('增量索引输出与全量解析不一致')

  console.log('\n一致性抽查：增量索引输出与全量解析一致 ✓')
  console.log('结论：稳态开销从 O(N) 次读盘+解析降为 O(N) 次 stat（无读盘/解析）。')
} finally {
  rmSync(dataDir, { recursive: true, force: true })
}
