import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { NOTIFICATION_VISIBLE_LIMIT, useUiStore } from '@/stores/ui'
import gamePageSource from '@/pages/GamePage.vue?raw'

describe('BUG-DIALOG-010 通知浮层具有显示上限与真正队列', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    useUiStore().clearNotifications()
    vi.useRealTimers()
  })

  it('同时只显示三条，其余按产生顺序排队', () => {
    const ui = useUiStore()
    for (let i = 1; i <= 6; i += 1) ui.notify(`通知${i}`, 'gold', 3000)
    expect(NOTIFICATION_VISIBLE_LIMIT).toBe(3)
    expect(ui.notifications.map(item => item.message)).toEqual(['通知1', '通知2', '通知3'])
    expect(ui.notificationQueue.map(item => item.message)).toEqual(['通知4', '通知5', '通知6'])
  })

  it('手动关闭后立即补入队首，并从补入时才开始自动消失计时', () => {
    const ui = useUiStore()
    for (let i = 1; i <= 4; i += 1) ui.notify(`通知${i}`, 'info', 3000)
    const secondId = ui.notifications[1].id
    vi.advanceTimersByTime(2000)
    ui.dismissNotification(secondId)
    expect(ui.notifications.map(item => item.message)).toEqual(['通知1', '通知3', '通知4'])
    expect(ui.notificationQueue).toHaveLength(0)

    vi.advanceTimersByTime(1000)
    expect(ui.notifications.map(item => item.message)).toEqual(['通知4'])
    vi.advanceTimersByTime(1999)
    expect(ui.notifications.map(item => item.message)).toEqual(['通知4'])
    vi.advanceTimersByTime(1)
    expect(ui.notifications).toHaveLength(0)
  })

  it('队列逐批自动提升，排队期间不会提前过期', () => {
    const ui = useUiStore()
    for (let i = 1; i <= 5; i += 1) ui.notify(`通知${i}`, 'success', 1000)
    vi.advanceTimersByTime(1000)
    expect(ui.notifications.map(item => item.message)).toEqual(['通知4', '通知5'])
    expect(ui.notificationQueue).toHaveLength(0)
    vi.advanceTimersByTime(999)
    expect(ui.notifications).toHaveLength(2)
    vi.advanceTimersByTime(1)
    expect(ui.notifications).toHaveLength(0)
  })

  it('duration=0 的通知保留到玩家手动关闭', () => {
    const ui = useUiStore()
    const id = ui.notify('需要确认的错误', 'error', 0)
    vi.advanceTimersByTime(60_000)
    expect(ui.notifications.map(item => item.message)).toEqual(['需要确认的错误'])
    ui.dismissNotification(id)
    expect(ui.notifications).toHaveLength(0)
  })

  it('页面通知轨固定脱离文档流，并显示排队摘要与独立关闭按钮', () => {
    expect(gamePageSource).toContain('position: fixed')
    expect(gamePageSource).toContain('ui.notificationQueue.length')
    expect(gamePageSource).toContain('另有 {{ ui.notificationQueue.length }} 条通知排队中')
    expect(gamePageSource).toContain('class="toast-close"')
  })
})
