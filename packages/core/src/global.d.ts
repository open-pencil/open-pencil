interface Window {
  queryLocalFonts?(): Promise<
    {
      family: string
      fullName: string
      style: string
      postscriptName: string
      blob(): Promise<Blob>
    }[]
  >
}
