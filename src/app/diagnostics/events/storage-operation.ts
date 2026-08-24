import type { OutboxJobType } from '@/app/storage/sync/types'

export type StorageDiagnosticOperation = 'upload' | 'download' | 'delete' | 'list'

export function storageOperationForJob(type: OutboxJobType): StorageDiagnosticOperation {
  switch (type) {
    case 'putCanvas':
    case 'putThumb':
      return 'upload'
    case 'deleteCanvas':
      return 'delete'
    default:
      throw new Error('Unsupported outbox job type')
  }
}
