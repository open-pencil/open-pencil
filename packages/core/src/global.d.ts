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

interface Uint8ArrayConstructor {
  fromBase64(base64: string, options?: { alphabet?: 'base64' | 'base64url' }): Uint8Array
}

interface Uint8Array {
  toBase64(options?: { alphabet?: 'base64' | 'base64url' }): string
}
