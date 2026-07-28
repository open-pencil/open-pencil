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

declare module '*.md' {
  const content: string
  export default content
}

declare module '*?raw' {
  const content: string
  export default content
}
