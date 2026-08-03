import { useLocalStorage } from '@vueuse/core'

/**
 * Whether configured cloud storage actually receives uploads.
 *
 * Separate from having credentials on purpose. Clearing the key to stop
 * syncing means re-entering it to start again, and it destroys the one piece
 * of state that is genuinely inconvenient to recreate. This is a switch:
 * the destination stays configured, uploads stop.
 *
 * Off means PAUSE, not withdraw. Documents already in the bucket stay there,
 * the bucket keeps listing, and nothing is deleted. Turning it back on resumes
 * from where it left off.
 */
export const backupToCloud = useLocalStorage('open-pencil:storage:backup-enabled', true)

export function setBackupToCloud(enabled: boolean): void {
  backupToCloud.value = enabled
}

/** True when a save should reach the remote at all. */
export function backupIsActive(): boolean {
  return backupToCloud.value
}
