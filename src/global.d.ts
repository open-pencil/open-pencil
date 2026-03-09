interface GestureEvent extends UIEvent {
  scale: number
  rotation: number
  clientX: number
  clientY: number
}

interface FilePickerAcceptType {
  description: string
  accept: Record<string, string[]>
}

interface FilePickerOptions {
  types?: FilePickerAcceptType[]
  suggestedName?: string
}

interface Window {
  showOpenFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(options?: FilePickerOptions): Promise<FileSystemFileHandle>
  queryLocalFonts?(): Promise<
    {
      family: string
      fullName: string
      style: string
      postscriptName: string
      blob(): Promise<Blob>
    }[]
  >
  // oxlint-disable-next-line typescript/no-explicit-any
  __OPEN_PENCIL_SET_TRANSPORT__?(factory: () => any): void
  // Typed as `any` to avoid circular reference with EditorStore.
  // The assignment in EditorView.vue is type-safe; test code uses `!` assertion.
  // oxlint-disable-next-line typescript/no-explicit-any
  __OPEN_PENCIL_STORE__?: any
}
