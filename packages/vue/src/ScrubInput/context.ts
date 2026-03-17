import { type InjectionKey, inject, provide } from 'vue'
import type { Ref } from 'vue'

export interface ScrubInputContext {
  modelValue: Ref<number | symbol>
  displayValue: Ref<string>
  isMixed: Ref<boolean>
  editing: Ref<boolean>
  scrubbing: Ref<boolean>
  inputRef: Ref<HTMLInputElement | null>
  startScrub: (e: PointerEvent) => void
  startEdit: () => void
  commitEdit: (e: Event) => void
  onKeydown: (e: KeyboardEvent) => void
}

export const SCRUB_INPUT_KEY: InjectionKey<ScrubInputContext> = Symbol('scrub-input')

export function provideScrubInput(ctx: ScrubInputContext) {
  provide(SCRUB_INPUT_KEY, ctx)
}

export function useScrubInput(): ScrubInputContext {
  const ctx = inject(SCRUB_INPUT_KEY)
  if (!ctx) throw new Error('[open-pencil] useScrubInput() called outside <ScrubInputRoot>')
  return ctx
}
