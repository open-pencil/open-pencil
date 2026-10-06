import { shallowReactive } from 'vue'

import { stripReferencedNodeContext, stripRevertedTurnContext } from '@/app/ai/chat/context'

const visibleText = shallowReactive(new Map<string, string>())

export function visibleMessageText(messageId: string, fallback: string): string {
  return visibleText.get(messageId) ?? fallback
}

export function visibleUserMessageText(messageId: string, text: string): string {
  // The revert note comes after any referenced nodes, so it goes first.
  return visibleMessageText(messageId, stripReferencedNodeContext(stripRevertedTurnContext(text)))
}

export function setVisibleMessageText(messageId: string, text: string): void {
  visibleText.set(messageId, text)
}

export function clearVisibleMessageText(): void {
  visibleText.clear()
}
