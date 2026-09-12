/**
 * 引擎命令注册表直测(engine/engine-commands.js)
 * 锁定两个关键语义:注册后正确转发;未注册就调用必须 fail loud。
 */
import { describe, expect, it } from 'vitest'
import { createEngineCommands } from '@/engine/engine-commands'

describe('createEngineCommands', () => {
  it('注册后按名转发参数与返回值', () => {
    const commands = createEngineCommands()
    expect(() => commands.nextEvent()).toThrow()
    commands.register('nextEvent', (a, b) => a + b)
    expect(commands.nextEvent(2, 3)).toBe(5)
  })

  it('未注册就调用直接抛错,不静默吞掉(修复旧 late?.() 的隐患)', () => {
    const commands = createEngineCommands()
    expect(() => commands.recordEventDiscoveries({ id: 'x' }))
      .toThrowError(/recordEventDiscoveries/)
  })

  it('重复注册以后注册者为准', () => {
    const commands = createEngineCommands()
    commands.register('nextEvent', () => 'first')
    commands.register('nextEvent', () => 'second')
    expect(commands.nextEvent()).toBe('second')
  })
})
