import { fontFallbackEntry, loadRemoteFallbackFamilies } from '#core/text/fallbacks'

export const BUNDLED_CJK_FAMILY = 'Noto Sans SC'
export const BUNDLED_CJK_FONT_URL = '/NotoSansSC-Regular.woff2'

export interface CJKFallbackHost {
  getFontProvider(): unknown
  getFallbackUserAgent(): string | undefined
  getCjkFallbackFamilies(): string[]
  getLoadedFamilies(): Map<string, ArrayBuffer>
  fetchBundledFont(url: string): Promise<ArrayBuffer | null>
  registerFontInCanvasKit(family: string, data: ArrayBuffer): boolean
  registerAndCache(family: string, style: string, buffer: ArrayBuffer): ArrayBuffer | null
  findLocalFont(
    family: string,
    style?: string,
    options?: { allowVariable?: boolean }
  ): Promise<ArrayBuffer | null>
  loadFont(family: string, style?: string): Promise<ArrayBuffer | null>
  registerFontInBrowser(family: string, style: string, data: ArrayBuffer): void
  onFallbackLoadFailed?(): void
  onFallbackLoaded?(): void
}

export class FontCJKFallback {
  private bundledCJKBuffer: ArrayBuffer | null = null
  private bundledCJKFetch: Promise<ArrayBuffer | null> | null = null
  private listeners = new Set<() => void>()
  private promise: Promise<string[]> | null = null

  constructor(private readonly host: CJKFallbackHost) {}

  onLoaded(callback: () => void): void {
    this.listeners.add(callback)
  }

  prefetch(): void {
    if (this.bundledCJKBuffer || this.bundledCJKFetch) return
    void this.getBundledCJKBuffer()
  }

  applyBundledIfReady(): void {
    if (this.bundledCJKBuffer) this.applyBundledToProvider(this.bundledCJKBuffer)
  }

  async ensureBundled(): Promise<string[]> {
    const families = this.host.getCjkFallbackFamilies()
    if (families.includes(BUNDLED_CJK_FAMILY)) {
      this.applyBundledIfReady()
      return families
    }
    if (!this.host.getFontProvider()) {
      this.prefetch()
      return []
    }
    await this.tryBundledFonts()
    return this.host.getCjkFallbackFamilies()
  }

  async ensure(): Promise<string[]> {
    const families = this.host.getCjkFallbackFamilies()
    if (families.length > 0) {
      this.applyBundledIfReady()
      return families
    }
    if (!this.host.getFontProvider()) {
      this.prefetch()
      if (this.promise) return this.promise
      return []
    }
    if (!this.promise) {
      this.promise = this.loadFallbacks().finally(() => {
        this.promise = null
        if (this.host.getCjkFallbackFamilies().length === 0) this.host.onFallbackLoadFailed?.()
      })
    }
    return this.promise
  }

  private async loadFallbacks(): Promise<string[]> {
    if (!this.host.getCjkFallbackFamilies().includes(BUNDLED_CJK_FAMILY)) {
      await this.tryBundledFonts()
    }
    await this.tryLocalFonts()
    if (this.host.getCjkFallbackFamilies().length === 0) await this.tryGoogleFonts()
    if (this.host.getCjkFallbackFamilies().length > 0) this.notifyLoaded()
    return this.host.getCjkFallbackFamilies()
  }

  private async getBundledCJKBuffer(): Promise<ArrayBuffer | null> {
    if (this.bundledCJKBuffer) return this.bundledCJKBuffer
    if (!this.bundledCJKFetch) {
      this.bundledCJKFetch = this.host
        .fetchBundledFont(BUNDLED_CJK_FONT_URL)
        .then((buf) => {
          this.bundledCJKBuffer = buf
          if (buf) this.applyBundledToProvider(buf)
          return buf
        })
        .catch((e) => {
          console.warn(`Bundled CJK font load failed for "${BUNDLED_CJK_FAMILY}":`, e)
          return null
        })
    }
    return this.bundledCJKFetch
  }

  private addFamily(family: string, { prepend = false }: { prepend?: boolean } = {}): void {
    const families = this.host.getCjkFallbackFamilies()
    if (families.includes(family)) return
    if (prepend) families.unshift(family)
    else families.push(family)
  }

  private registerAliases(
    family: string,
    style: string,
    buffer: ArrayBuffer,
    aliases: string[]
  ): void {
    const loadedFamilies = this.host.getLoadedFamilies()
    const names = [...new Set([family, ...aliases])]
    for (const name of names) {
      this.host.registerFontInCanvasKit(name, buffer)
      loadedFamilies.set(`${name}|${style}`, buffer)
      this.host.registerFontInBrowser(name, style, buffer)
    }
  }

  private applyBundledToProvider(buffer: ArrayBuffer): boolean {
    if (!this.host.getFontProvider()) return false
    if (!this.host.registerFontInCanvasKit(BUNDLED_CJK_FAMILY, buffer)) return false

    const manifest = fontFallbackEntry('cjk', this.host.getFallbackUserAgent())
    const aliases = [...new Set([...manifest.remoteFamilies, ...manifest.localFamilies])]
    this.registerAliases(BUNDLED_CJK_FAMILY, 'Regular', buffer, aliases)
    const wasReady = this.host.getCjkFallbackFamilies().includes(BUNDLED_CJK_FAMILY)
    if (!wasReady) this.addFamily(BUNDLED_CJK_FAMILY, { prepend: true })
    this.notifyLoaded()
    return true
  }

  private async tryBundledFonts(): Promise<void> {
    const buffer = await this.getBundledCJKBuffer()
    if (buffer) this.applyBundledToProvider(buffer)
  }

  private async tryLocalFonts(): Promise<void> {
    const manifest = fontFallbackEntry('cjk', this.host.getFallbackUserAgent())
    const families = this.host.getCjkFallbackFamilies()
    const loadedFamilies = this.host.getLoadedFamilies()
    for (const family of manifest.localFamilies) {
      if (families.includes(family)) continue
      if (loadedFamilies.has(`${family}|Regular`)) {
        this.addFamily(family)
        continue
      }
      const buffer = await this.host.findLocalFont(family, undefined, { allowVariable: true })
      if (buffer && this.host.registerAndCache(family, 'Regular', buffer)) {
        this.addFamily(family)
      }
    }
  }

  private async tryGoogleFonts(): Promise<void> {
    const manifest = fontFallbackEntry('cjk', this.host.getFallbackUserAgent())
    const loaded = await loadRemoteFallbackFamilies(
      manifest.remoteFamilies,
      this.host.getCjkFallbackFamilies(),
      async (family) => Boolean(await this.host.loadFont(family, 'Regular'))
    )
    for (const family of loaded) this.addFamily(family)
  }

  private notifyLoaded(): void {
    if (this.host.getCjkFallbackFamilies().length === 0) return
    this.host.onFallbackLoaded?.()
    for (const callback of this.listeners) callback()
  }
}
