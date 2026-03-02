// Identical to ai-elements-vue — PR compatible
import type { InjectionKey, Ref } from 'vue'
import { inject } from 'vue'

export interface ReasoningContextValue {
  isStreaming: Ref<boolean>
  isOpen: Ref<boolean>
  setIsOpen: (open: boolean) => void
  duration: Ref<number | undefined>
}

export const ReasoningKey: InjectionKey<ReasoningContextValue> = Symbol('ReasoningContext')

export function useReasoningContext() {
  const ctx = inject<ReasoningContextValue>(ReasoningKey)
  if (!ctx) throw new Error('Reasoning components must be used within <Reasoning>')
  return ctx
}
