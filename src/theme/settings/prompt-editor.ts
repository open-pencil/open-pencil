/**
 * A prompt's editor in Settings: a bordered field that shows keyboard focus on its border, as a
 * panel field does, since CodeMirror draws no outline of its own.
 */
export default {
  slots: {
    root: 'overflow-hidden rounded-md border border-border focus-within:border-panel-focus'
  }
} as const
