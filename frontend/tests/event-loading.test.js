import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { EVENTS } from '@/data/game-data'
import '@/data/events-expanded'

const mainSource = readFileSync(path.resolve('src/main.js'), 'utf8')
const gamePageSource = readFileSync(path.resolve('src/pages/GamePage.vue'), 'utf8')

describe('扩展事件按需加载', () => {
  it('入口不再全量导入扩展包，GamePage 只创建一个动态加载 Promise', () => {
    expect(mainSource).not.toContain('events-expanded')
    expect(gamePageSource).toContain("import('@/data/events-expanded.js')")
    expect(gamePageSource).toMatch(/if \(!expandedEventsPromise\) expandedEventsPromise = import\(/)
  })

  it('扩展包加载后原始与扩展事件完整且 ID 不重复', () => {
    expect(EVENTS.length).toBeGreaterThan(350)
    expect(new Set(EVENTS.map(event => event.id)).size).toBe(EVENTS.length)
  })
})
