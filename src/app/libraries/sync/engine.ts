import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import { watchDebounced } from '@vueuse/core'
import { computed } from 'vue'

import { IS_BROWSER } from '@open-pencil/core/constants'
import { errorMessage, isAbortError } from '@open-pencil/std/errors'
import { BACKOFF, backoffDelay, SECOND_MS } from '@open-pencil/std/timing'

import {
  activeStorageProviderID,
  createActiveStorageAdapter,
  isStorageConfigured,
  readStoragePreferences,
  storageProviderRegistry,
  type LibraryObjectStore
} from '@/app/integrations/storage'
import { LocalLibraryCatalog, localLibraryCatalog } from '@/app/libraries/catalog/local'
import { MirroredLibraryCatalog } from '@/app/libraries/catalog/mirrored'
import { StorageLibraryCatalog } from '@/app/libraries/catalog/storage'
import { libraryPreferences } from '@/app/libraries/preferences'
import {
  currentNeedsProviders,
  resetNeedsProvidersForTests,
  watchNeedsProviders
} from '@/app/libraries/sync/needs'
import { LibrarySyncSession, type PassRequest } from '@/app/libraries/sync/session'
import {
  clearFailedResolutions,
  currentResolutionsEpoch,
  failSyncingResolutions,
  librarySyncRemote,
  librarySyncResolution
} from '@/app/libraries/sync/status'
import { deleteAppDatabase } from '@/app/storage/idb'

const MAX_ATTEMPTS = 8
/** How often the pump re-checks connectivity while offline, like the document sync engine. */
const OFFLINE_WAKE_MS = 5 * SECOND_MS
/** Preference writes arrive in bursts; one remote rebuild per settle. */
const REMOTE_REBUILD_DEBOUNCE_MS = 200

/**
 * What one kick asks of the pull passes; a bare kick probes. Signals that only change local
 * needs — a binding write — pass `probe: false`, since the remote did not change.
 */
export type LibrarySyncKick = Partial<PassRequest>

/** Injectable seams, filled by `resetLibrarySyncForTests`. */
export interface LibrarySyncDeps {
  objects?: (providerId: string) => Promise<LibraryObjectStore | null>
  remoteDebounceMs?: number
}

const deps: LibrarySyncDeps = {}

let running = false
let dirty = false
let wakeTimer: ReturnType<typeof setTimeout> | null = null
let onlineBound = false
let parked = false
let attempts = 0
let nextAttemptAt = 0
let pendingProbe = false
/** Once a surface asked for instance or publication revisions, every pass keeps them in the needs. */
let wantsInstanceRevs = false
let wantsPublication = false
let session: LibrarySyncSession | null = null
let lastDbName: string | null = null
/** Rebuilds run one at a time, so `whenLibrarySyncReady` is just the chain's tail. */
let rebuilding: Promise<void> = Promise.resolve()
let stopWatches: (() => void) | null = null

function isOnline(): boolean {
  // Runtimes without a network indicator, such as workers and tests, count as online.
  if (typeof navigator === 'undefined') return true
  const online: unknown = Reflect.get(navigator, 'onLine')
  return online !== false
}

/** The remote the preferences name: the active provider's storage catalog, or none. */
const remoteSourceKey = computed(() => {
  if (libraryPreferences.value.catalogSource !== 'storage') return null
  const providerId = activeStorageProviderID.value
  return `${providerId} ${JSON.stringify(readStoragePreferences(providerId))}`
})

/** The mirror database's name changes with the remote identity, so stale mirrors never mix. */
function mirrorDbName(providerId: string): string {
  let fields: readonly { id: string }[]
  try {
    fields = storageProviderRegistry.get(providerId).preferenceFields
  } catch {
    fields = []
  }
  if (fields.length === 0) return `open-pencil-libraries-remote-${providerId}`
  const digest = bytesToHex(sha256(utf8ToBytes(JSON.stringify(readStoragePreferences(providerId)))))
  return `open-pencil-libraries-remote-${providerId}-${digest.slice(0, 8)}`
}

async function openLibraryObjects(providerId: string): Promise<LibraryObjectStore | null> {
  if (deps.objects) return deps.objects(providerId)
  // An adapter built on missing credentials would fail mid-request, a retryable fault, not "no remote".
  if (!(await isStorageConfigured(providerId))) return null
  return createActiveStorageAdapter(providerId).libraryObjects ?? null
}

// ─── Remote rebuild ─────────────────────────────────────────────────────────

async function rebuildRemote(): Promise<void> {
  const sourceKey = remoteSourceKey.value
  const previous = session
  session = null
  librarySyncRemote.value = null
  // Marks from the previous mirror would keep the new remote's revisions from pulling.
  librarySyncResolution.value = new Map()
  await previous?.close()
  if (!sourceKey) return
  const providerId = activeStorageProviderID.value
  const dbName = mirrorDbName(providerId)
  lastDbName = dbName
  const mirror = new LocalLibraryCatalog(dbName)
  // Opening the database also yields, so kicks queued behind this rebuild drain against no remote.
  const opened = await mirror
    .listLibraries()
    .then(() => true)
    .catch((error: unknown) => {
      console.warn('[Library sync] mirror failed to open:', errorMessage(error))
      return false
    })
  if (!opened || remoteSourceKey.value !== sourceKey) {
    await mirror.close().catch(() => undefined)
    return
  }
  const catalog = new MirroredLibraryCatalog(
    localLibraryCatalog,
    async () => {
      const objects = await openLibraryObjects(providerId)
      return objects ? new StorageLibraryCatalog(objects) : null
    },
    mirror,
    () => void kickLibrarySync()
  )
  if (libraryPreferences.value.catalogSource === 'storage') catalog.useStorage()
  const next = new LibrarySyncSession(mirror, catalog, dbName, () => openLibraryObjects(providerId))
  session = next
  librarySyncRemote.value = next
  // A new remote starts fresh: the old one's parked state and backoff must not stall it.
  parked = false
  attempts = 0
  nextAttemptAt = 0
  pendingProbe = true
  void runPump()
}

function scheduleRebuild(): Promise<void> {
  rebuilding = rebuilding.then(rebuildRemote).catch((error: unknown) => {
    console.warn('[Library sync] remote rebuild failed:', errorMessage(error))
  })
  return rebuilding
}

// ─── Pump ───────────────────────────────────────────────────────────────────

function failAttempt(cause: unknown): void {
  attempts += 1
  console.warn('[Library sync] pull failed:', errorMessage(cause))
  if (attempts >= MAX_ATTEMPTS) {
    parked = true
    failSyncingResolutions()
    return
  }
  nextAttemptAt = Date.now() + backoffDelay(attempts - 1, BACKOFF.retry)
  scheduleWake(nextAttemptAt - Date.now())
}

/**
 * Milliseconds until a pass may run: never while parked, a connectivity check while offline,
 * the backoff otherwise.
 */
function waitBeforePass(): number {
  if (parked) return Infinity
  return isOnline() ? nextAttemptAt - Date.now() : OFFLINE_WAKE_MS
}

async function pullOnce(probe: boolean): Promise<void> {
  const current = session
  const wait = waitBeforePass()
  // A deferred pass keeps its probe for the next one.
  if (wait > 0 || !current) {
    pendingProbe ||= probe
    if (wait > 0 && wait !== Infinity) scheduleWake(wait)
    return
  }
  // The epoch beside the session identity: a resume during the pass voids its verdicts,
  // so an outcome recorded after one must be discarded the same way as one recorded after
  // a remote rebuild.
  const resumeEpoch = currentResolutionsEpoch()
  try {
    const outcome = await current.pass(
      { probe, includeInstanceRevs: wantsInstanceRevs, includePublication: wantsPublication },
      currentNeedsProviders()
    )
    // A pass whose remote was replaced while it ran must not write its outcome — a park,
    // the backoff, or a clean slate — onto the live remote. The session object is the
    // generation: `close()` can only stop checkpoints, but a pass has outcome paths that
    // return past the last one, so the identity check goes here instead. A resume keeps
    // the session but voids every pre-resume verdict; the epoch is that generation.
    if (current !== session || resumeEpoch !== currentResolutionsEpoch()) return
    if (outcome.permanent !== undefined) {
      parked = true
      failSyncingResolutions()
      console.warn('[Library sync] parked on a permanent error:', errorMessage(outcome.permanent))
      return
    }
    if (outcome.transient !== undefined) {
      failAttempt(outcome.transient)
      return
    }
    attempts = 0
    nextAttemptAt = 0
  } catch (error) {
    // A pass of a replaced remote or one a resume superseded must not count against the
    // live remote's backoff.
    if (current !== session || resumeEpoch !== currentResolutionsEpoch()) return
    if (!isAbortError(error)) failAttempt(error)
  }
}

function scheduleWake(ms: number) {
  if (wakeTimer != null) clearTimeout(wakeTimer)
  wakeTimer = setTimeout(
    () => {
      wakeTimer = null
      pendingProbe = true
      void runPump()
    },
    Math.max(0, ms)
  )
}

function ensureOnlineListeners() {
  if (onlineBound || !IS_BROWSER) return
  onlineBound = true
  window.addEventListener('online', () => {
    pendingProbe = true
    void runPump()
  })
}

/** The single-flight pump: a kick during a pass sets `dirty`, so one more pass covers it. */
async function runPump(): Promise<void> {
  ensureOnlineListeners()
  if (running) {
    dirty = true
    return
  }
  running = true
  try {
    do {
      dirty = false
      const probe = pendingProbe
      pendingProbe = false
      try {
        await pullOnce(probe)
      } catch (error) {
        failAttempt(error)
      }
    } while (dirty as boolean)
  } finally {
    running = false
    if (dirty) void runPump()
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Ask the engine for work. Bare calls probe the remote; needs-only signals pass flags. */
export async function kickLibrarySync(kick: LibrarySyncKick = {}): Promise<void> {
  pendingProbe ||= kick.probe ?? true
  wantsInstanceRevs ||= kick.includeInstanceRevs === true
  wantsPublication ||= kick.includePublication === true
  await runPump()
}

/**
 * Wakes the engine after credentials or settings change, or a row's retry: clears the parked
 * state, the backoff and every failed mark — the next pass derives those needs again — and
 * runs a fresh probe.
 */
export async function resumeLibrarySync(): Promise<void> {
  parked = false
  attempts = 0
  nextAttemptAt = 0
  clearFailedResolutions()
  await kickLibrarySync()
}

/** Deletes the mirror database after credentials were cleared, then rebuilds onto an empty one. */
export async function clearLibraryMirror(): Promise<void> {
  const current = session
  const dbName = current?.dbName ?? lastDbName
  if (current) {
    session = null
    librarySyncRemote.value = null
    await current.close()
  }
  if (dbName) {
    await deleteAppDatabase(dbName).catch((error: unknown) => {
      console.warn('[Library sync] mirror failed to delete:', errorMessage(error))
    })
  }
  await scheduleRebuild()
}

/** Starts the remote and open-tab watches and the first pull; returns the teardown. */
export function startLibrarySync(): () => void {
  ensureOnlineListeners()
  stopWatches?.()
  const stops: (() => void)[] = [
    watchDebounced(remoteSourceKey, () => void scheduleRebuild(), {
      debounce: deps.remoteDebounceMs ?? REMOTE_REBUILD_DEBOUNCE_MS,
      immediate: true
    }),
    watchNeedsProviders(() => void kickLibrarySync({ probe: false }))
  ]
  stopWatches = () => {
    for (const stop of stops) stop()
  }
  void kickLibrarySync()
  return stopWatches
}

/** Resolves once the queued remote rebuilds settled, a live remote or `null`. */
export function whenLibrarySyncReady(): Promise<void> {
  return rebuilding
}

function isPumpBusy(): boolean {
  return running || dirty
}

/** Resolves once the pump has drained. A scheduled retry wake is a settled state. */
export async function whenLibrarySyncIdle(): Promise<void> {
  await rebuilding
  while (isPumpBusy()) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

/** Test-facing counters: whether the engine parked and how many pulls failed in a row. */
export function librarySyncDiagnostics(): {
  parked: boolean
  attempts: number
  nextAttemptAt: number
} {
  return { parked, attempts, nextAttemptAt }
}

/** Test seam: clears module state and substitutes dependencies for the next run. */
export async function resetLibrarySyncForTests(overrides: LibrarySyncDeps = {}): Promise<void> {
  deps.objects = overrides.objects
  deps.remoteDebounceMs = overrides.remoteDebounceMs
  running = false
  dirty = false
  parked = false
  attempts = 0
  nextAttemptAt = 0
  pendingProbe = false
  wantsInstanceRevs = false
  wantsPublication = false
  lastDbName = null
  onlineBound = false
  if (wakeTimer != null) {
    clearTimeout(wakeTimer)
    wakeTimer = null
  }
  stopWatches?.()
  stopWatches = null
  const previous = session
  session = null
  librarySyncRemote.value = null
  await previous?.close()
  rebuilding = Promise.resolve()
  resetNeedsProvidersForTests()
  librarySyncResolution.value = new Map()
}
