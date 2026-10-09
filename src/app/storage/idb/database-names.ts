/** Stable names for the app's independent IndexedDB databases. */
export const APP_DATABASE_NAMES = {
  chats: 'open-pencil-chats',
  credentials: 'open-pencil-credentials',
  libraries: 'open-pencil-libraries',
  localCanvas: 'open-pencil-cloud-local',
  outbox: 'open-pencil-cloud-outbox',
  recovery: 'open-pencil-recovery',
  diagnostics: 'open-pencil-diagnostics',
  /** Written and deleted once per page, to learn whether the engine stores Blobs. */
  blobProbe: 'open-pencil-blob-probe'
} as const
