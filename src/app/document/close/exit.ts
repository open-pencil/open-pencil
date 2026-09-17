import { prepareForClose } from '@/app/tabs'

let approved = false

/** True once every open document agreed to close, so later requests skip the prompt. */
export function isExitApproved(): boolean {
  return approved
}

export async function confirmAppExit(): Promise<boolean> {
  if (approved) return true
  if (!(await prepareForClose())) return false
  approved = true
  return true
}

/** Shared by the native Quit item and the platform exit request. */
export async function requestAppExit(): Promise<void> {
  if (!(await confirmAppExit())) return
  const { exit } = await import('@tauri-apps/plugin-process')
  await exit(0)
}
