import type { InjectionKey, Ref } from 'vue'

/**
 * Whether the Markdown around a component is streaming with animations on, so an inline
 * component such as a chat reference can fade in like the words beside it.
 */
export const MARKDOWN_ANIMATING: InjectionKey<Readonly<Ref<boolean>>> = Symbol('markdown-animating')
