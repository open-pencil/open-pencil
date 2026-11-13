interface FontData {
  family: string
  fullName: string
  postscriptName: string
  style: string
  blob(): Promise<Blob>
}

interface Window {
  queryLocalFonts?(): Promise<FontData[]>
}

declare module '*?raw' {
  const content: string
  export default content
}

/** A file a Vite build serves and emits, as its URL (`runtime-assets/install.ts`). */
declare module '*?url' {
  const url: string
  export default url
}

/** opencc-js types its converters only; a dictionary module is `key value…` entries joined by `|`. */
declare module 'opencc-js/dict/TSCharacters' {
  const entries: string
  export default entries
}
