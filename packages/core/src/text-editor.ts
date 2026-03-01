import type { CanvasKit, Paragraph, TypefaceFontProvider } from 'canvaskit-wasm'
import type { SceneNode } from './scene-graph'
import type { Rect } from './types'

export interface TextCaret {
  x: number
  y0: number
  y1: number
}

export interface TextEditorState {
  nodeId: string
  text: string
  cursor: number
  selectionAnchor: number | null
  paragraph: Paragraph | null
}

export class TextEditor {
  private ck: CanvasKit
  private fontProvider: TypefaceFontProvider | null = null
  private _state: TextEditorState | null = null
  caretVisible = true

  constructor(ck: CanvasKit) {
    this.ck = ck
  }

  get state(): TextEditorState | null {
    return this._state
  }

  get isActive(): boolean {
    return this._state !== null
  }

  get nodeId(): string | null {
    return this._state?.nodeId ?? null
  }

  setFontProvider(provider: TypefaceFontProvider | null): void {
    this.fontProvider = provider
  }

  start(node: SceneNode): void {
    this._state = {
      nodeId: node.id,
      text: node.text,
      cursor: node.text.length,
      selectionAnchor: null,
      paragraph: null
    }
    this.rebuildParagraph(node)
  }

  stop(): { nodeId: string; text: string } | null {
    if (!this._state) return null
    const result = { nodeId: this._state.nodeId, text: this._state.text }
    this._state.paragraph?.delete()
    this._state = null
    return result
  }

  rebuildParagraph(node: SceneNode): void {
    const s = this._state
    if (!s || !this.fontProvider) return

    s.paragraph?.delete()

    const paraStyle = new this.ck.ParagraphStyle({
      textAlign: this.getTextAlign(node.textAlignHorizontal),
      textStyle: {
        color: this.ck.BLACK,
        fontFamilies: [node.fontFamily || 'Inter'],
        fontSize: node.fontSize || 14,
        fontStyle: { weight: { value: node.fontWeight || 400 } },
        letterSpacing: node.letterSpacing || 0,
        heightMultiplier: node.lineHeight
          ? node.lineHeight / (node.fontSize || 14)
          : undefined
      }
    })
    const builder = this.ck.ParagraphBuilder.MakeFromFontProvider(paraStyle, this.fontProvider)
    builder.addText(s.text)
    s.paragraph = builder.build()
    s.paragraph.layout(node.width || 1e6)
    builder.delete()
  }

  hasSelection(): boolean {
    const s = this._state
    return s !== null && s.selectionAnchor !== null && s.selectionAnchor !== s.cursor
  }

  getSelectionRange(): [number, number] | null {
    const s = this._state
    if (!s || s.selectionAnchor === null || s.selectionAnchor === s.cursor) return null
    const lo = Math.min(s.cursor, s.selectionAnchor)
    const hi = Math.max(s.cursor, s.selectionAnchor)
    return [lo, hi]
  }

  getSelectedText(): string {
    const range = this.getSelectionRange()
    if (!range || !this._state) return ''
    return this._state.text.slice(range[0], range[1])
  }

  selectAll(): void {
    const s = this._state
    if (!s) return
    s.selectionAnchor = 0
    s.cursor = s.text.length
  }

  selectWord(pos: number): void {
    const s = this._state
    if (!s) return
    const text = s.text
    let start = pos
    let end = pos
    while (start > 0 && !isWordBoundary(text[start - 1])) start--
    while (end < text.length && !isWordBoundary(text[end])) end++
    s.selectionAnchor = start
    s.cursor = end
  }

  setCursorAt(x: number, y: number, extend = false): void {
    const s = this._state
    if (!s?.paragraph) return
    const pos = s.paragraph.getGlyphPositionAtCoordinate(x, y).pos
    if (extend) {
      if (s.selectionAnchor === null) s.selectionAnchor = s.cursor
    } else {
      s.selectionAnchor = null
    }
    s.cursor = pos
  }

  selectWordAt(x: number, y: number): void {
    const s = this._state
    if (!s?.paragraph) return
    const pos = s.paragraph.getGlyphPositionAtCoordinate(x, y).pos
    this.selectWord(pos)
  }

  insert(text: string, node: SceneNode): void {
    const s = this._state
    if (!s) return
    const range = this.getSelectionRange()
    if (range) {
      s.text = s.text.slice(0, range[0]) + text + s.text.slice(range[1])
      s.cursor = range[0] + text.length
    } else {
      s.text = s.text.slice(0, s.cursor) + text + s.text.slice(s.cursor)
      s.cursor += text.length
    }
    s.selectionAnchor = null
    this.rebuildParagraph(node)
  }

  backspace(node: SceneNode): void {
    const s = this._state
    if (!s) return
    const range = this.getSelectionRange()
    if (range) {
      s.text = s.text.slice(0, range[0]) + s.text.slice(range[1])
      s.cursor = range[0]
    } else if (s.cursor > 0) {
      s.text = s.text.slice(0, s.cursor - 1) + s.text.slice(s.cursor)
      s.cursor--
    }
    s.selectionAnchor = null
    this.rebuildParagraph(node)
  }

  delete(node: SceneNode): void {
    const s = this._state
    if (!s) return
    const range = this.getSelectionRange()
    if (range) {
      s.text = s.text.slice(0, range[0]) + s.text.slice(range[1])
      s.cursor = range[0]
    } else if (s.cursor < s.text.length) {
      s.text = s.text.slice(0, s.cursor) + s.text.slice(s.cursor + 1)
    }
    s.selectionAnchor = null
    this.rebuildParagraph(node)
  }

  moveLeft(extend = false): void {
    const s = this._state
    if (!s) return
    if (!extend && this.hasSelection()) {
      const range = this.getSelectionRange()
      if (range) s.cursor = range[0]
      s.selectionAnchor = null
      return
    }
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null
    if (s.cursor > 0) s.cursor--
  }

  moveRight(extend = false): void {
    const s = this._state
    if (!s) return
    if (!extend && this.hasSelection()) {
      const range = this.getSelectionRange()
      if (range) s.cursor = range[1]
      s.selectionAnchor = null
      return
    }
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null
    if (s.cursor < s.text.length) s.cursor++
  }

  moveUp(extend = false): void {
    const s = this._state
    if (!s?.paragraph) return
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null

    const caret = this.getCaretRect()
    if (!caret) return
    const fontSize = s.paragraph.getLineMetrics()[0]?.height ?? 14
    const newPos = s.paragraph.getGlyphPositionAtCoordinate(caret.x, caret.y0 - fontSize / 2).pos
    s.cursor = newPos
  }

  moveDown(extend = false): void {
    const s = this._state
    if (!s?.paragraph) return
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null

    const caret = this.getCaretRect()
    if (!caret) return
    const fontSize = s.paragraph.getLineMetrics()[0]?.height ?? 14
    const newPos = s.paragraph.getGlyphPositionAtCoordinate(caret.x, caret.y1 + fontSize / 2).pos
    s.cursor = newPos
  }

  moveToLineStart(extend = false): void {
    const s = this._state
    if (!s?.paragraph) return
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null

    const lineNum = s.paragraph.getLineNumberAt(s.cursor)
    if (lineNum < 0) return
    const metrics = s.paragraph.getLineMetricsAt(lineNum)
    if (metrics) s.cursor = metrics.startIndex
  }

  moveToLineEnd(extend = false): void {
    const s = this._state
    if (!s?.paragraph) return
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null

    const lineNum = s.paragraph.getLineNumberAt(s.cursor)
    if (lineNum < 0) return
    const metrics = s.paragraph.getLineMetricsAt(lineNum)
    if (metrics) s.cursor = metrics.endExcludingWhitespaces
  }

  moveWordLeft(extend = false): void {
    const s = this._state
    if (!s) return
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null

    let pos = s.cursor
    while (pos > 0 && isWordBoundary(s.text[pos - 1])) pos--
    while (pos > 0 && !isWordBoundary(s.text[pos - 1])) pos--
    s.cursor = pos
  }

  moveWordRight(extend = false): void {
    const s = this._state
    if (!s) return
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null

    let pos = s.cursor
    while (pos < s.text.length && !isWordBoundary(s.text[pos])) pos++
    while (pos < s.text.length && isWordBoundary(s.text[pos])) pos++
    s.cursor = pos
  }

  getCaretRect(): TextCaret | null {
    const s = this._state
    if (!s?.paragraph) return null

    const text = s.text
    const cursor = s.cursor

    if (text.length === 0) {
      const metrics = s.paragraph.getLineMetrics()
      if (metrics.length === 0) return null
      const line = metrics[0]
      return { x: line.left, y0: 0, y1: line.height }
    }

    let lo: number
    let hi: number
    let useRight = false

    if (cursor === 0) {
      lo = 0
      hi = 1
    } else if (cursor >= text.length) {
      lo = text.length - 1
      hi = text.length
      useRight = true
    } else {
      lo = cursor
      hi = cursor + 1
    }

    const rects = s.paragraph.getRectsForRange(
      lo,
      hi,
      this.ck.RectHeightStyle.Max,
      this.ck.RectWidthStyle.Tight
    )
    if (rects.length === 0) return null
    const [left, top, right, bottom] = rects[0].rect
    return {
      x: useRight ? right : left,
      y0: top,
      y1: bottom
    }
  }

  getSelectionRects(): Rect[] {
    const s = this._state
    if (!s?.paragraph) return []
    const range = this.getSelectionRange()
    if (!range) return []

    const rects = s.paragraph.getRectsForRange(
      range[0],
      range[1],
      this.ck.RectHeightStyle.Max,
      this.ck.RectWidthStyle.Tight
    )
    return rects.map((r) => {
      const [left, top, right, bottom] = r.rect
      return { x: left, y: top, width: right - left, height: bottom - top }
    })
  }

  private getTextAlign(align: string) {
    switch (align) {
      case 'CENTER':
        return this.ck.TextAlign.Center
      case 'RIGHT':
        return this.ck.TextAlign.Right
      case 'JUSTIFIED':
        return this.ck.TextAlign.Justify
      default:
        return this.ck.TextAlign.Left
    }
  }
}

function isWordBoundary(ch: string): boolean {
  return /\s|[.,;:!?()[\]{}"'`<>/\\|@#$%^&*~+=\-_]/.test(ch)
}
