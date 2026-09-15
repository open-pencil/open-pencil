interface GestureEvent extends UIEvent {
  scale: number
  rotation: number
  clientX: number
  clientY: number
}

declare module '*?raw' {
  const content: string
  export default content
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  // Match the app's opaque fallback: an index signature breaks Storybook default-arg inference.
  const component: DefineComponent<object, object, unknown>
  export default component
}
