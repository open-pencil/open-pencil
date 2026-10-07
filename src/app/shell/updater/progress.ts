import { progressPercent } from '@/components/ui/feedback/progress'

import type { UpdaterMessages } from './messages'

export interface DownloadProgress {
  downloaded: number
  total?: number
}

export function downloadProgressLabel(
  messages: UpdaterMessages,
  { downloaded, total }: DownloadProgress
): string {
  if (!total) return messages.downloadProgressUnknown({ downloaded: formatBytes(downloaded) })
  return messages.downloadProgress({
    percent: progressPercent({ value: downloaded, max: total }) ?? 0,
    downloaded: formatBytes(downloaded),
    total: formatBytes(total)
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib.toFixed(1)} KiB`
  return `${(kib / 1024).toFixed(1)} MiB`
}
