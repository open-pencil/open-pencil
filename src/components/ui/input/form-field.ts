import { tv } from 'tailwind-variants'
import { nextTick } from 'vue'

import type { ComponentUI } from '@/components/ui/types'
import formFieldTheme from '@/theme/input/form-field'

export const formField = tv(formFieldTheme)
export type FormFieldUI = ComponentUI<typeof formFieldTheme>

/**
 * Moves focus to the first field under `root` marked `aria-invalid`, once the errors a failed
 * submit just set have reached the page, so the person lands on what needs fixing.
 */
export async function focusFirstInvalid(root: HTMLElement | null | undefined): Promise<void> {
  await nextTick()
  root?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
