import { exit } from '@tauri-apps/plugin-process'

import { allTabs, prepareForClose } from '@/app/tabs'

/** Shared approval so the window close handler and the Quit item cannot prompt twice. */
export function createExitApproval(
  confirmDocuments: () => Promise<boolean>,
  hasUnsavedDocuments: () => boolean
) {
  let approved = false
  let confirmation: Promise<boolean> | null = null

  return {
    isApproved: () => approved,
    asksBeforeLeaving: () => !approved && hasUnsavedDocuments(),
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

const approval = createExitApproval(prepareForClose, () => allTabs.value.some((tab) => tab.isDirty))

/** True once every open document agreed to close, so later requests skip the prompt. */
export function isExitApproved(): boolean {
  return approval.isApproved()
}

/** True when leaving the page asks first, so the user can still choose to stay. */
export function pageAsksBeforeLeaving(): boolean {
  return approval.asksBeforeLeaving()
}

export function confirmAppExit(): Promise<boolean> {
  return approval.confirm()
}

/** Shared by the native Quit item and the platform exit request. */
export async function requestAppExit(): Promise<void> {
  if (!(await confirmAppExit())) return
  await exit(0)
}
