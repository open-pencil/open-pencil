import {
  readStoragePreferences,
  storageProviderRegistry,
  type StorageProviderID
} from '@/app/integrations/storage'

declare const STORAGE_TARGET_ID: unique symbol

/**
 * Identifies one immutable destination: a provider, its non-secret
 * configuration, and a reference to where its credentials live.
 *
 * Branded, so it cannot be compared with or assigned from a bare string. A
 * target id and a provider id are both strings and read alike, which is how
 * `document-sync-errors` came to filter rows with `syncTargetId === providerId()`
 * — a comparison that is false for every row, because a target id is
 * `provider#hash`. It emptied the error map on every failure. The brand makes
 * that a compile error rather than something a reviewer has to notice.
 */
export type StorageTargetID = string & { readonly [STORAGE_TARGET_ID]: true }

/**
 * Label a string that is already a target id.
 *
 * The single place the brand is applied, so every entry point is greppable:
 * ids derived here, and ids read back from storage, which arrive as plain
 * strings. Do not use it to make a provider id fit.
 */
export function asStorageTargetID(value: string): StorageTargetID {
  return value as StorageTargetID
}

export type StorageTarget = {
  id: StorageTargetID
  providerId: StorageProviderID
  /** Non-secret endpoint/bucket/database configuration, snapshotted. */
  preferences: Readonly<Record<string, string>>
  /**
   * WHERE the secret lives, never the secret itself.
   *
   * Rotating a key behind this reference must not create a new target —
   * otherwise every credential refresh would orphan the documents already
   * synced to that bucket.
   */
  credentialRef: string
}

/**
 * Stable id for a destination.
 *
 * Derived from the configuration rather than generated, so reconnecting to a
 * bucket you used before resolves to the SAME target and its documents are
 * recognised. A random id would make disconnect/reconnect look like a move to a
 * new destination and strand everything already uploaded there.
 *
 * Secret fields are excluded from the derivation for the same reason as the
 * credential reference: the destination has not changed just because the key
 * did.
 */
function deriveTargetId(
  providerId: StorageProviderID,
  preferences: Record<string, string>
): StorageTargetID {
  const canonical = Object.keys(preferences)
    .sort()
    .map((field) => `${field}=${preferences[field]}`)
    // A separator no preference value can contain. Written as an escape rather
    // than the raw byte it used to be: embedded literally it made git treat this
    // whole file as binary, so it had no diff at all and `grep` skipped it. The
    // character is unchanged, and it must stay unchanged — it feeds the hash
    // every stored `syncTargetId` was derived from.
    .join('\u0000')
  return asStorageTargetID(`${providerId}#${fnv1a(canonical)}`)
}

/**
 * FNV-1a, 32-bit. Not cryptographic and does not need to be — this is a lookup
 * key over a handful of short configuration strings, and a collision would need
 * two different buckets to hash equal, which `providerId` already partitions.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/** Non-secret configuration for a provider, in a stable shape. */
function snapshotPreferences(providerId: StorageProviderID): Record<string, string> {
  const provider = storageProviderRegistry.get(providerId)
  const stored = readStoragePreferences(providerId)
  const snapshot: Record<string, string> = {}
  for (const field of provider.preferenceFields) {
    if (field.secret) continue
    const value = stored[field.id]
    if (value) snapshot[field.id] = value
  }
  return snapshot
}

function credentialRefFor(providerId: StorageProviderID): string {
  const provider = storageProviderRegistry.get(providerId)
  const fields = provider.credentialFields.map((field) => field.id).sort()
  return `${providerId}:${fields.join(',')}`
}

/**
 * The target a provider currently points at, or `null` when it is not
 * configured enough to name a destination.
 *
 * Null is the honest answer for an unconfigured provider: pinning a job to a
 * target that names no bucket would be worse than refusing to enqueue it.
 */
export function currentStorageTarget(providerId: StorageProviderID): StorageTarget | null {
  const provider = storageProviderRegistry.get(providerId)
  const preferences = snapshotPreferences(providerId)
  const required = provider.preferenceFields.filter((field) => field.required)
  if (required.some((field) => !preferences[field.id])) return null
  return {
    id: deriveTargetId(providerId, preferences),
    providerId,
    preferences,
    credentialRef: credentialRefFor(providerId)
  }
}

/** Provider a target id belongs to, recovered without consulting live state. */
export function providerIdOfTarget(targetId: StorageTargetID | null): StorageProviderID | null {
  // Accepts the absence directly. Callers used to pass `''` to mean "no target",
  // which only worked because an empty string happens to parse to no provider.
  if (targetId === null) return null
  const separator = targetId.indexOf('#')
  if (separator <= 0) return null
  const providerId = targetId.slice(0, separator) as StorageProviderID
  return storageProviderRegistry.has(providerId) ? providerId : null
}

/**
 * Whether a target still names the destination its provider points at.
 *
 * A queued job whose target no longer matches must NOT be redirected — the
 * user changed buckets, and the job's bytes belong to the old one.
 */
export function targetIsCurrent(target: StorageTargetID): boolean {
  const providerId = providerIdOfTarget(target)
  if (!providerId) return false
  return currentStorageTarget(providerId)?.id === target
}

/**
 * Target id a provider currently names, for the paths that ESTABLISH where a
 * document belongs — a save, an import, a seed from remote.
 *
 * Legitimate live-state read: the document's destination is wherever the user
 * points that provider now. What must never read live state is resolving an
 * already-queued job, whose bytes were intended for the place recorded on it.
 */
export function currentTargetIdFor(providerId: StorageProviderID): StorageTargetID | null {
  return currentStorageTarget(providerId)?.id ?? null
}
