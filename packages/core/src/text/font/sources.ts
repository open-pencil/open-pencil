import type { WebFontProviderId } from '#core/text/web-fonts'

export interface FontInfo {
  family: string
  fullName: string
  style: string
  postscriptName: string
}

export type LocalFontAccessState = 'unsupported' | 'prompt' | 'granted' | 'denied'
export type FontFamilySource = 'local' | 'bundled' | 'fallback' | WebFontProviderId
export type FontLoadedSource = FontFamilySource | 'cache' | 'registered'

export interface FontFamilyOption {
  family: string
  source: FontFamilySource
}

export interface DownloadedFontCache {
  read(family: string, style: string, characters?: string): Promise<ArrayBuffer | null>
  write(family: string, style: string, data: ArrayBuffer, characters?: string): Promise<void>
}

export type HostFontLoader = (family: string, style: string) => Promise<ArrayBuffer | null>

/** Why an installed face could not be loaded, when the host can tell. */
export type FontUnavailableReason = 'unsupported-format'

/** Thrown by a {@link HostFontLoader} for an installed face whose outlines cannot be drawn. */
export class UnsupportedFontFormatError extends Error {
  readonly reason: FontUnavailableReason = 'unsupported-format'

  constructor(family: string, style: string) {
    super(`Font outlines are in an unsupported format: ${family} ${style}`)
    this.name = 'UnsupportedFontFormatError'
  }
}
