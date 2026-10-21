/**
 * Everything the rest of the app uses from Cloud. A build with `VITE_OPENPENCIL_CLOUD=off`
 * resolves this module to `./off`, which offers the same names and does nothing, so Cloud's code
 * stays out of that build; app code outside Cloud's folders imports Cloud only from here.
 */
import { watchCloudRooms } from '../rooms/live'
import { startCloudSessions } from '../sessions/startup'

export {
  cloudAIAvailable,
  cloudAIClient,
  cloudAIWorkspaces,
  cloudBillingURL,
  type CloudAIWorkspace
} from '../ai/access'
export { cloudDocumentAddress } from '../documents/link'
export { isCloudBinding } from '../documents/status'
export { openCloudShare } from '../sharing/dialog'
export { cloudSaveDestinations, cloudUploadFailure, signInToSaveTo } from '../documents/save'
export { useHomeCloud } from '../home'
export { CLOUD_STORAGE_PROVIDER_ID } from '../sessions/token'
export {
  isVersionHistoryOpen,
  openVersionDialog,
  openVersionHistory,
  shownEditorStore,
  versionPreviewKey
} from '../versions/history'

/** This build has Cloud; whether it shows depends on the server's listing or a preview. */
export const CLOUD_INCLUDED: boolean = true

/** Starts Cloud sign-ins, links, and live rooms; returns what stops the room watcher. */
export function startCloud(options: { leaveLinkAddress(): Promise<unknown> }): () => void {
  const stop = watchCloudRooms()
  void startCloudSessions(options)
  return stop
}
