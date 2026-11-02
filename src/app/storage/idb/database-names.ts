/** Stable names for the app's independent IndexedDB databases. */
export const APP_DATABASE_NAMES = {
  chats: 'lawha-chats',
  credentials: 'lawha-credentials',
  libraries: 'lawha-libraries',
  localCanvas: 'lawha-cloud-local',
  outbox: 'lawha-cloud-outbox',
  recovery: 'lawha-recovery',
  diagnostics: 'lawha-diagnostics',
  skills: 'lawha-skills',
  /** Written and deleted once per page, to learn whether the engine stores Blobs. */
  blobProbe: 'lawha-blob-probe'
} as const
