import { prepareForClose } from '@/app/tabs'

/** Shared approval so the window close handler and the Quit item cannot prompt twice. */
export function createExitApproval(confirmDocuments: () => Promise<boolean>) {
  let approved = false
  let confirmation: Promise<boolean> | null = null

  return {
    isApproved: () => approved,
    confirm: async (): Promise<boolean> => {
      if (approved) return true
      confirmation ??= confirmDocuments()
        .then((agreed) => {
          if (agreed) approved = true
          return agreed
        })
        .finally(() => {
          confirmation = null
        })
      return confirmation
    }
  }
}

const approval = createExitApproval(prepareForClose)

/** True once every open document agreed to close, so later requests skip the prompt. */
export function isExitApproved(): boolean {
  return approval.isApproved()
}

export function confirmAppExit(): Promise<boolean> {
  return approval.confirm()
}

/** Shared by the native Quit item and the platform exit request. */
export async function requestAppExit(): Promise<void> {
  if (!(await confirmAppExit())) return
  const { exit } = await import('@tauri-apps/plugin-process')
  await exit(0)
}
