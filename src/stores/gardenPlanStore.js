import { computed, ref, watch } from 'vue'
import {
  clearSession,
  fetchPlan,
  getMe,
  hasSession,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  syncPlan,
} from '../services/apiClient.js'

const LOCAL_PLAN_KEY = 'garten-plan:v1'
const DEVICE_ID_KEY = 'garten-device-id'
const SCHEMA_VERSION = 1

function createDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY)
  if (existing) return existing

  const id = crypto.randomUUID()
  localStorage.setItem(DEVICE_ID_KEY, id)
  return id
}

function sanitizeEntry(entry) {
  if (!entry || typeof entry !== 'object') return null
  if (!entry.id || !entry.plantId) return null

  return {
    id: String(entry.id),
    plantId: String(entry.plantId),
    varietyId: entry.varietyId ? String(entry.varietyId) : null,
    actualSowingDate: entry.actualSowingDate ? String(entry.actualSowingDate) : '',
  }
}

function readLocalPlan() {
  try {
    const raw = localStorage.getItem(LOCAL_PLAN_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw)
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null

    return {
      year: Number(parsed.year) || new Date().getFullYear(),
      entries: Array.isArray(parsed.selectedEntries)
        ? parsed.selectedEntries.map(sanitizeEntry).filter(Boolean)
        : [],
      revision: Number(parsed.revision) || 0,
      updatedAt: parsed.updatedAt || null,
    }
  } catch {
    return null
  }
}

function isRemoteNewer(remote, localUpdatedAt) {
  if (!remote?.updatedAt) return false
  if (!localUpdatedAt) return true
  return new Date(remote.updatedAt).getTime() > new Date(localUpdatedAt).getTime()
}

const deviceId = createDeviceId()
const localPlan = readLocalPlan()

export const year = ref(localPlan?.year || new Date().getFullYear())
export const selectedEntries = ref(localPlan?.entries || [])
export const user = ref(null)
export const authLoading = ref(false)
export const syncStatus = ref(localPlan ? 'local' : 'idle')
export const syncMessage = ref(localPlan ? 'Lokal gespeichert' : 'Noch nicht gespeichert')
export const serverRevision = ref(localPlan?.revision || 0)
export const conflictPlan = ref(null)

let saveTimer = null
let syncTimer = null
let isHydrating = false
let lastLocalUpdatedAt = localPlan?.updatedAt || null

export const isAuthenticated = computed(() => Boolean(user.value))
export const hasSyncConflict = computed(() => Boolean(conflictPlan.value))

function currentLocalPayload() {
  lastLocalUpdatedAt = new Date().toISOString()
  return {
    schemaVersion: SCHEMA_VERSION,
    year: year.value,
    selectedEntries: selectedEntries.value,
    revision: serverRevision.value,
    updatedAt: lastLocalUpdatedAt,
  }
}

function saveLocalPlan() {
  localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify(currentLocalPayload()))
  if (!isAuthenticated.value) {
    syncStatus.value = 'local'
    syncMessage.value = 'Lokal gespeichert'
  }
}

function scheduleSaveAndSync() {
  if (isHydrating) return

  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(saveLocalPlan, 150)

  if (isAuthenticated.value) {
    syncStatus.value = 'pending'
    syncMessage.value = 'Sync ausstehend'
    window.clearTimeout(syncTimer)
    syncTimer = window.setTimeout(() => {
      syncCurrentPlan().catch(() => {})
    }, 900)
  }
}

function applyRemotePlan(plan) {
  isHydrating = true
  year.value = plan.year
  selectedEntries.value = plan.entries.map(entry => ({
    id: entry.id,
    plantId: entry.plantId,
    varietyId: entry.varietyId || null,
    actualSowingDate: entry.actualSowingDate || '',
  }))
  serverRevision.value = plan.revision || 0
  lastLocalUpdatedAt = plan.updatedAt || new Date().toISOString()
  localStorage.setItem(LOCAL_PLAN_KEY, JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    year: year.value,
    selectedEntries: selectedEntries.value,
    revision: serverRevision.value,
    updatedAt: lastLocalUpdatedAt,
  }))
  isHydrating = false
}

export async function initializeSession() {
  if (!hasSession()) return

  authLoading.value = true
  try {
    const data = await getMe()
    user.value = data.user
    await reconcileCurrentPlan()
  } catch {
    clearSession()
    user.value = null
    syncStatus.value = 'local'
    syncMessage.value = 'Lokal gespeichert'
  } finally {
    authLoading.value = false
  }
}

export async function login(email, password) {
  authLoading.value = true
  try {
    user.value = await apiLogin(email, password)
    await reconcileCurrentPlan()
  } finally {
    authLoading.value = false
  }
}

export async function register(email, password) {
  authLoading.value = true
  try {
    user.value = await apiRegister(email, password)
    await reconcileCurrentPlan()
  } finally {
    authLoading.value = false
  }
}

export async function logout() {
  authLoading.value = true
  try {
    await apiLogout()
  } finally {
    user.value = null
    serverRevision.value = 0
    conflictPlan.value = null
    syncStatus.value = 'local'
    syncMessage.value = 'Lokal gespeichert'
    authLoading.value = false
  }
}

export async function reconcileCurrentPlan() {
  if (!isAuthenticated.value) return

  syncStatus.value = 'syncing'
  syncMessage.value = 'Synchronisiere'

  const remote = await fetchPlan(year.value)
  const localHasEntries = selectedEntries.value.length > 0
  const remoteHasEntries = remote.plan.entries.length > 0

  if (!remoteHasEntries && localHasEntries) {
    await syncCurrentPlan(remote.plan.revision)
    return
  }

  if (remoteHasEntries && (!localHasEntries || isRemoteNewer(remote.plan, lastLocalUpdatedAt))) {
    applyRemotePlan(remote.plan)
    syncStatus.value = 'synced'
    syncMessage.value = 'Synchronisiert'
    return
  }

  await syncCurrentPlan(remote.plan.revision)
}

export async function syncCurrentPlan(baseRevision = serverRevision.value) {
  if (!isAuthenticated.value) return

  syncStatus.value = 'syncing'
  syncMessage.value = 'Synchronisiere'
  conflictPlan.value = null

  try {
    const result = await syncPlan(year.value, {
      clientId: deviceId,
      baseRevision,
      entries: selectedEntries.value,
    })
    serverRevision.value = result.plan.revision
    lastLocalUpdatedAt = result.plan.updatedAt
    saveLocalPlan()
    syncStatus.value = 'synced'
    syncMessage.value = 'Synchronisiert'
  } catch (error) {
    if (error.status === 409 && error.data?.plan) {
      conflictPlan.value = error.data.plan
      syncStatus.value = 'conflict'
      syncMessage.value = 'Konflikt erkannt'
      return
    }

    syncStatus.value = 'error'
    syncMessage.value = 'Sync fehlgeschlagen'
    throw error
  }
}

export async function useRemoteConflictPlan() {
  if (!conflictPlan.value) return
  applyRemotePlan(conflictPlan.value)
  conflictPlan.value = null
  syncStatus.value = 'synced'
  syncMessage.value = 'Serverstand übernommen'
}

export async function keepLocalConflictPlan() {
  if (!conflictPlan.value) return
  const revision = conflictPlan.value.revision
  conflictPlan.value = null
  await syncCurrentPlan(revision)
}

watch([year, selectedEntries], scheduleSaveAndSync, { deep: true })
