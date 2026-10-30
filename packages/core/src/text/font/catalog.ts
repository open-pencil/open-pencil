import {
  facesFromStyles,
  hasFamilyFace,
  standardFaces,
  type FamilyFace
} from '#core/text/font/faces'
import type { FontInfo } from '#core/text/font/sources'

/** Where a family's faces come from besides the host's catalog. */
export interface FamilyFaceSources {
  /** The browser's installed fonts, once listed. */
  localFonts(): FontInfo[] | null
  /** A web provider's faces for a family; none when no provider has it. */
  webFaces(family: string): Promise<FamilyFace[]>
  /** The style keys of a family's bundled faces. */
  bundledStyles(family: string): string[]
}

/** The faces each family has, as its installed, web, or bundled fonts list them. */
export class FamilyFaceCatalog {
  private hostStyles = new Map<string, readonly string[]>()
  private lookups = new Map<string, Promise<FamilyFace[] | null>>()
  private found = new Map<string, FamilyFace[] | null>()
  private listeners = new Set<() => void>()

  constructor(private readonly sources: FamilyFaceSources) {}

  /** The system fonts a desktop host lists, by family, with the style names of their faces. */
  setHostCatalog(fonts: readonly { family: string; styles: readonly string[] }[]): void {
    this.hostStyles = new Map(fonts.map((font) => [font.family, [...font.styles]]))
    this.forget()
  }

  /**
   * The faces a family has: its installed fonts', else a web provider's, else the bundled ones;
   * `null` when nothing says, so a caller offers every weight.
   */
  faces(family: string): Promise<FamilyFace[] | null> {
    let lookup = this.lookups.get(family)
    if (!lookup) {
      const pending = this.lookUp(family).then((faces) => {
        // Faces forgotten while the lookup ran came from the sources it read before.
        if (this.lookups.get(family) === pending) this.found.set(family, faces)
        return faces
      })
      lookup = pending
      this.lookups.set(family, lookup)
    }
    return lookup
  }

  /** The faces `faces` found for a family, once it has; `undefined` before. */
  foundFaces(family: string): FamilyFace[] | null | undefined {
    return this.found.get(family)
  }

  /**
   * The faces known for a family without asking a provider: those looked up, else its installed
   * or bundled faces. A web family not looked up has none here, and its faces take Google
   * Fonts' names, which a provider would give them too.
   */
  facesSync(family: string): FamilyFace[] | null {
    return this.found.get(family) ?? this.installedFaces(family) ?? this.bundledFaces(family)
  }

  /** Whether a family has this face, or nothing found so far says it has not. */
  offersFace(family: string, weight: number, italic: boolean): boolean {
    const faces = this.found.get(family)
    return !faces || hasFamilyFace(faces, weight, italic)
  }

  /**
   * Calls the listener whenever the faces found so far are forgotten, as when the host's font
   * catalog arrives or online providers change, so a caller asks for its families again.
   */
  onReset(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Forgets the faces found so far, whose sources changed. */
  forget(): void {
    this.lookups.clear()
    this.found.clear()
    for (const listener of this.listeners) listener()
  }

  private async lookUp(family: string): Promise<FamilyFace[] | null> {
    const installed = this.installedFaces(family)
    if (installed) return installed
    const web = await this.sources.webFaces(family)
    if (web.length > 0) return web
    return this.bundledFaces(family)
  }

  /** The faces of an installed family, from the host's catalog or the browser's local fonts. */
  private installedFaces(family: string): FamilyFace[] | null {
    // The desktop host lists weights by generated names, so its faces take the standard names.
    const host = this.hostStyles.get(family)
    if (host && host.length > 0) return standardFaces(host)
    const local = this.sources.localFonts()?.filter((font) => font.family === family) ?? []
    return local.length > 0 ? facesFromStyles(local.map((font) => font.style)) : null
  }

  /** The bundled fonts name their faces as Google Fonts does; their keys are style keys. */
  private bundledFaces(family: string): FamilyFace[] | null {
    const styles = this.sources.bundledStyles(family)
    return styles.length > 0 ? standardFaces(styles) : null
  }
}
