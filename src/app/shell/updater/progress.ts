import { formatBytes, progressPercent } from '@/components/ui/feedback/progress'

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
