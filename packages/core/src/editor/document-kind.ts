/**
 * What kind of document is open.
 *
 * Design files (`.fig`, `.pen`, imported SVG/HTML) and decks (`.deck`, Figma Slides)
 * share the same scene graph and most of the same tooling, but differ systematically in
 * how the editor presents and persists them. That difference is modelled here once,
 * rather than re-derived from filenames or view flags at each call site.
 */
export type DocumentKind = 'design' | 'deck'

/** Editor behaviour that varies by {@link DocumentKind}. */
export interface DocumentKindRules {
  /** Rulers are available along the canvas edges (subject to the user's own toggle). */
  rulers: boolean
  /** Re-fit content when the canvas host resizes, instead of holding the camera still. */
  autoFitOnResize: boolean
  /** Canvas backdrop is fixed by the format and not user-editable. */
  lockedBackdrop: boolean
  /** Per-page camera is remembered when switching pages. */
  persistPageViewports: boolean
  /** What the left rail shows. */
  leftRail: 'layers' | 'filmstrip'
  /** Native format this document saves back to. */
  saveFormat: 'fig' | 'deck'
  /** Page background is user-editable from the design panel. */
  pageBackgroundEditable: boolean
  /**
   * Top-level artboards can be selected and edited as objects.
   *
   * False for decks: a slide is fixed presentation chrome that holds the content, not a
   * shape the user owns — clicks pass through it to whatever is on the slide.
   */
  artboardSelectable: boolean
  /**
   * The camera is tied to the artboard.
   *
   * A deck shows one fixed slide with nothing around it, so there is nowhere to pan to:
   * while the slide fits it stays centred, and once zoomed in past the fit the camera
   * stops at the slide's edges rather than sliding it off screen.
   */
  lockViewportToArtboard: boolean
}

const RULES: Record<DocumentKind, DocumentKindRules> = {
  design: {
    rulers: true,
    autoFitOnResize: false,
    lockedBackdrop: false,
    persistPageViewports: true,
    leftRail: 'layers',
    saveFormat: 'fig',
    pageBackgroundEditable: true,
    artboardSelectable: true,
    lockViewportToArtboard: false
  },
  deck: {
    // Figma Slides-style canvas: fixed backdrop, always-fit slide, filmstrip navigator.
    rulers: false,
    autoFitOnResize: true,
    lockedBackdrop: true,
    persistPageViewports: false,
    leftRail: 'filmstrip',
    saveFormat: 'deck',
    pageBackgroundEditable: false,
    artboardSelectable: false,
    lockViewportToArtboard: true
  }
}

/** Behaviour rules for a document kind. */
export function documentKindRules(kind: DocumentKind): DocumentKindRules {
  return RULES[kind] ?? RULES.design
}

/** The kind produced by an IO format id (see the format registry's `sourceFormat`). */
export function documentKindForSourceFormat(sourceFormat: string): DocumentKind {
  return sourceFormat === 'deck' ? 'deck' : 'design'
}

/** The kind implied by a file name, for entry points that only have a name to go on. */
export function documentKindForFileName(fileName: string): DocumentKind {
  return /\.deck$/i.test(fileName) ? 'deck' : 'design'
}
