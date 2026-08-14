import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const gamePageSource = readFileSync(path.resolve('src/pages/GamePage.vue'), 'utf8')
const battleSource = readFileSync(path.resolve('src/composables/useBattleSystem.js'), 'utf8')
const eventEngineSource = readFileSync(path.resolve('src/composables/useEventEngine.js'), 'utf8')

describe('战斗生命周期与页面导航守卫', () => {
  it('GamePage 在战斗中拦截所有路由离开并显示可见提示', () => {
    expect(gamePageSource).toContain("import { useRouter, onBeforeRouteLeave } from 'vue-router'")
    expect(gamePageSource).toMatch(/onBeforeRouteLeave\([\s\S]*?battle\.isActive\(\)[\s\S]*?战斗进行中，请先完成战斗或撤退[\s\S]*?next\(false\)/)
  })

  it('页面强制卸载会调用 resetBattle，nextEvent 不负责偷偷复位', () => {
    expect(gamePageSource).toMatch(/onBeforeUnmount\([\s\S]*?battle\.resetBattle\(\)/)
    const nextEventStart = eventEngineSource.indexOf('function nextEvent()')
    const nextEventEnd = eventEngineSource.indexOf('\n  function ', nextEventStart + 1)
    const nextEventBlock = eventEngineSource.slice(nextEventStart, nextEventEnd > 0 ? nextEventEnd : undefined)
    expect(nextEventBlock).not.toContain('resetBattle()')
    expect(battleSource).toContain('function resetBattle()')
  })
})
