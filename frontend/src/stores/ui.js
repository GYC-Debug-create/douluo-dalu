/**
 * UI 状态 Store
 * 管理 UI 运行时状态（弹窗、通知、设置等），不参与存档
 */
import { defineStore } from 'pinia'

export const NOTIFICATION_VISIBLE_LIMIT = 3
const notificationTimers = new Map()

function clearNotificationTimer(id) {
  const timer = notificationTimers.get(id)
  if (timer !== undefined) clearTimeout(timer)
  notificationTimers.delete(id)
}

export const useUiStore = defineStore('ui', {
  state: () => ({
    activeModal: null,
    modalData: null,
    notifications: [],
    notificationQueue: [],
    settings: {
      animation: 'normal',
      autoSave: true,
      music: true,
      sfx: true
    },
    loading: false
  }),
  actions: {
    openModal(name, data = null) {
      this.activeModal = name
      this.modalData = data
    },
    closeModal() {
      this.activeModal = null
      this.modalData = null
    },
    notify(message, type = 'info', duration = 3000) {
      const id = Date.now() + Math.random()
      const item = { id, message: String(message), type, duration: Math.max(0, Number(duration) || 0) }
      if (this.notifications.length < NOTIFICATION_VISIBLE_LIMIT) {
        this.notifications.push(item)
        this.armNotification(item)
      } else {
        this.notificationQueue.push(item)
      }
      return id
    },
    armNotification(item) {
      clearNotificationTimer(item.id)
      if (item.duration <= 0) return
      notificationTimers.set(item.id, setTimeout(() => this.dismissNotification(item.id), item.duration))
    },
    promoteNotifications() {
      while (this.notifications.length < NOTIFICATION_VISIBLE_LIMIT && this.notificationQueue.length) {
        const next = this.notificationQueue.shift()
        this.notifications.push(next)
        this.armNotification(next)
      }
    },
    dismissNotification(id) {
      const idx = this.notifications.findIndex(n => n.id === id)
      if (idx >= 0) {
        clearNotificationTimer(id)
        this.notifications.splice(idx, 1)
        this.promoteNotifications()
        return
      }
      const queuedIdx = this.notificationQueue.findIndex(n => n.id === id)
      if (queuedIdx >= 0) this.notificationQueue.splice(queuedIdx, 1)
    },
    clearNotifications() {
      for (const item of this.notifications) clearNotificationTimer(item.id)
      this.notifications = []
      this.notificationQueue = []
    },
    updateSetting(key, value) {
      this.settings[key] = value
    }
  }
})
