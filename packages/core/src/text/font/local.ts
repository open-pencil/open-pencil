import { IS_BROWSER } from '#core/constants'
import { SharedReads } from '#core/text/font/reads'
import type { FontInfo, LocalFontAccessState } from '#core/text/font/sources'
import { chooseLocalFontMatch } from '#core/text/font/style'

/** The fonts installed in the browser's system, read through the Local Font Access API. */
export class LocalFonts {
  private fonts: FontInfo[] | null = null
  private state: LocalFontAccessState = IS_BROWSER ? 'prompt' : 'unsupported'
  private readonly requests = new SharedReads()

  accessState(): LocalFontAccessState {
    return this.state
  }

  /** The installed fonts, once access was asked for; `null` before. */
  list(): FontInfo[] | null {
    return this.fonts
  }

  /** Asks for access and lists the installed fonts, one entry per family and style. */
  async requestAccess(): Promise<FontInfo[]> {
    if (!IS_BROWSER || !window.queryLocalFonts) {
      this.state = 'unsupported'
      this.fonts = []
      return []
    }
    try {
      const fonts = await window.queryLocalFonts()
      const seen = new Set<string>()
      const result: FontInfo[] = []
      for (const f of fonts) {
        const key = `${f.family}|${f.style}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push({
          family: f.family,
          fullName: f.fullName,
          style: f.style,
          postscriptName: f.postscriptName
        })
      }
      this.fonts = result
      this.state = 'granted'
      return result
    } catch {
      this.fonts = []
      this.state = 'denied'
      return []
    }
  }

  /** A face's bytes, once access is granted. */
  read(family: string, style?: string): Promise<ArrayBuffer | null> {
    if (!IS_BROWSER || !window.queryLocalFonts) return Promise.resolve(null)
    if (this.state !== 'granted') return Promise.resolve(null)
    // A query answers with a new blob, and so new bytes, every time; the face decides the match.
    return this.requests.read(`${family}|${style ?? ''}`, () => this.query(family, style))
  }

  private async query(family: string, style?: string): Promise<ArrayBuffer | null> {
    try {
      const fonts = await window.queryLocalFonts?.()
      if (!fonts) return null
      const match = chooseLocalFontMatch(fonts, family, style)
      if (!match) return null
      const blob: Blob = await match.blob()
      return await blob.arrayBuffer()
    } catch (e) {
      console.warn(`Local font access failed for "${family}" ${style ?? ''}:`, e)
      return null
    }
  }
}
