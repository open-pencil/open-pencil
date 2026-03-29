declare module 'opentype.js' {
  export interface OpenTypePathCommand {
    type: string
    x?: number
    y?: number
    x1?: number
    y1?: number
    x2?: number
    y2?: number
  }

  export interface OpenTypeGlyphPath {
    commands: OpenTypePathCommand[]
  }

  export interface OpenTypeGlyph {
    path: OpenTypeGlyphPath
    getPath(x: number, y: number, fontSize: number): OpenTypeGlyphPath
  }

  export interface OpenTypeFont {
    unitsPerEm: number
    stringToGlyphs(text: string): OpenTypeGlyph[]
  }

  export function parse(buffer: ArrayBuffer): OpenTypeFont
}
