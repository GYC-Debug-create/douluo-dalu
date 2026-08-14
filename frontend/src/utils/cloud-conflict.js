import { ref } from 'vue'

function normalizeVersion(value, fallback = 0) {
  const version = Number(value)
  return Number.isFinite(version) && version >= 0 ? version : fallback
}

export function createCloudConflictState() {
  return {
    pending: ref(null),
    showDialog: ref(false),
    currentVersion: ref(0)
  }
}

export function recordCloudConflict(state, result) {
  if (state.pending.value) return false
  const currentVersion = normalizeVersion(result?.currentVersion)
  state.pending.value = { currentVersion }
  state.currentVersion.value = currentVersion
  state.showDialog.value = true
  return true
}

export function keepCloudConflictLocal(state) {
  if (!state.pending.value) return false
  state.showDialog.value = false
  return true
}

export function reopenCloudConflict(state) {
  if (!state.pending.value) return false
  state.currentVersion.value = normalizeVersion(state.pending.value.currentVersion)
  state.showDialog.value = true
  return true
}

export function refreshCloudConflict(state, result) {
  if (!result?.conflict) return false
  const previousVersion = normalizeVersion(state.pending.value?.currentVersion)
  const currentVersion = normalizeVersion(result.currentVersion, previousVersion)
  state.pending.value = { ...(state.pending.value || {}), currentVersion }
  state.currentVersion.value = currentVersion
  state.showDialog.value = true
  return true
}

export function getCloudConflictVersion(state) {
  if (!state.pending.value) return null
  return normalizeVersion(state.pending.value.currentVersion)
}

export function clearCloudConflict(state) {
  state.pending.value = null
  state.currentVersion.value = 0
  state.showDialog.value = false
}
