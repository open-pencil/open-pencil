import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import type { CloudProviderId, S3CompatibleConfig } from '@/app/cloud/types'

const STORAGE_PREFIX = 'open-pencil:cloud:'

/**
 * Optional dev/local prefill from Vite env (`.env.local`, gitignored).
 * Only fills fields that are still empty so user edits in Settings win.
 * Never commit real values — use `.env.example` as the template.
 */
function envPrefill(name: string): string {
  const env = import.meta.env as Record<string, string | boolean | undefined>
  const value = env[`VITE_OPENPENCIL_CLOUD_S3_${name}`]
  return typeof value === 'string' ? value.trim() : ''
}

function withEnvDefault(stored: string, envName: string): string {
  if (stored.trim()) return stored
  if (envPrefillDisabled.value) return ''
  return envPrefill(envName)
}

export const cloudProviderId = useLocalStorage<CloudProviderId>(
  `${STORAGE_PREFIX}provider`,
  's3-compatible'
)

export const s3Endpoint = useLocalStorage(`${STORAGE_PREFIX}s3:endpoint`, '')
export const s3Bucket = useLocalStorage(`${STORAGE_PREFIX}s3:bucket`, '')
export const s3AccessKeyId = useLocalStorage(`${STORAGE_PREFIX}s3:access-key-id`, '')
export const s3SecretAccessKey = useLocalStorage(`${STORAGE_PREFIX}s3:secret-access-key`, '')

// Without this, "clear credentials" is a no-op in dev: the env prefill would
// immediately re-fill the empty slots and the app would stay configured.
const envPrefillDisabled = useLocalStorage(`${STORAGE_PREFIX}s3:env-prefill-disabled`, false)

/** Apply gitignored env prefill into empty localStorage slots (idempotent). */
export function prefillCloudCredentialsFromEnv(): void {
  if (envPrefillDisabled.value) return
  const endpoint = envPrefill('ENDPOINT')
  const bucket = envPrefill('BUCKET')
  const accessKeyId = envPrefill('ACCESS_KEY_ID')
  const secretAccessKey = envPrefill('SECRET_ACCESS_KEY')

  if (endpoint && !s3Endpoint.value.trim()) s3Endpoint.value = endpoint
  if (bucket && !s3Bucket.value.trim()) s3Bucket.value = bucket
  if (accessKeyId && !s3AccessKeyId.value.trim()) s3AccessKeyId.value = accessKeyId
  if (secretAccessKey && !s3SecretAccessKey.value.trim()) s3SecretAccessKey.value = secretAccessKey
}

// Run once on module load so Settings / isCloudConfigured see values immediately.
prefillCloudCredentialsFromEnv()

export function readS3Config(): S3CompatibleConfig {
  return {
    endpoint: withEnvDefault(s3Endpoint.value, 'ENDPOINT'),
    bucket: withEnvDefault(s3Bucket.value, 'BUCKET'),
    accessKeyId: withEnvDefault(s3AccessKeyId.value, 'ACCESS_KEY_ID'),
    secretAccessKey: withEnvDefault(s3SecretAccessKey.value, 'SECRET_ACCESS_KEY')
  }
}

export function isS3ConfigComplete(config: S3CompatibleConfig): boolean {
  return Boolean(config.endpoint && config.bucket && config.accessKeyId && config.secretAccessKey)
}

// S3-compatible is the only provider today; branch on cloudProviderId when more land.
export const isCloudConfigured = computed(() => isS3ConfigComplete(readS3Config()))

export function clearS3Credentials() {
  envPrefillDisabled.value = true
  s3Endpoint.value = ''
  s3Bucket.value = ''
  s3AccessKeyId.value = ''
  s3SecretAccessKey.value = ''
  // Drop local mirror + outbox so a later account doesn't see orphaned caches.
  void import('@/app/cloud/sync')
    .then((m) => m.clearCloudLocalMirror())
    .catch((error: unknown) => console.warn('[Cloud] failed to clear local mirror:', error))
}

export function setS3Credentials(config: S3CompatibleConfig) {
  envPrefillDisabled.value = false
  s3Endpoint.value = config.endpoint.trim()
  s3Bucket.value = config.bucket.trim()
  s3AccessKeyId.value = config.accessKeyId.trim()
  s3SecretAccessKey.value = config.secretAccessKey.trim()
}
