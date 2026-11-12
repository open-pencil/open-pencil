import type { StorageLimitReachedPayload } from '../schema'
import { greeting, type EmailTemplate } from './content'

/** The account holds all the storage its plan includes, so its workspaces are read-only. */
export const storageLimitReached: EmailTemplate<StorageLimitReachedPayload> = (
  payload,
  { t, storage }
) => {
  const amounts = { used: storage(payload.usedBytes), limit: storage(payload.limitBytes) }
  return {
    subject: t.storageFullSubject,
    preview: t.storageFullPreview(amounts),
    heading: t.storageFullHeading,
    paragraphs: [
      greeting(t, payload.name),
      t.storageFull(amounts),
      payload.upgradable ? t.storageFullUpgrade : t.storageFullFreeSpace
    ],
    action: {
      label: payload.upgradable ? t.storageFullAction : t.openCloud,
      url: payload.actionURL
    }
  }
}
