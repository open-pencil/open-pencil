import type { CanvasKit, Paragraph } from 'canvaskit-wasm'

import type { SkiaRenderer } from '#core/canvas'
import type { SceneNode } from '#core/scene-graph'
import type { Rect } from '#core/types'

import { resolveNodeTextDirection } from './direction'

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
  textDirection: 'LTR' | 'RTL'
}

export class TextEditor {
  private ck: CanvasKit
  private renderer: SkiaRenderer | null = null
  private _state: TextEditorState | null = null
  caretVisible = true

  constructor(ck: CanvasKit) {
    this.ck = ck
  }

  private prepareMove(extend: boolean): TextEditorState | null {
    const s = this._state
    if (!s) return null
    if (extend && s.selectionAnchor === null) s.selectionAnchor = s.cursor
    if (!extend) s.selectionAnchor = null
    return s
  }

  private replaceRange(start: number, end: number, text: string): TextEditorState | null {
    const s = this._state
    if (!s) return null
    s.text = s.text.slice(0, start) + text + s.text.slice(end)
    s.cursor = start + text.length
    s.selectionAnchor = null
    return s
  }

  private currentLineMetrics() {
    const s = this._state
    if (!s?.paragraph) return null
    const lineNum = s.paragraph.getLineNumberAt(s.cursor)
    return lineNum < 0 ? null : s.paragraph.getLineMetricsAt(lineNum)
  }

  private collapseSelectionTo(edge: 0 | 1): boolean {
    const s = this._state
    if (!s || !this.hasSelection()) return false
    const range = this.getSelectionRange()
    if (range) s.cursor = range[edge]
    s.selectionAnchor = null
    return true
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

  setRenderer(renderer: SkiaRenderer | null): void {
    this.renderer = renderer
  }

  start(node: SceneNode): void {
    this._state = {
      nodeId: node.id,
      text: node.text,
      cursor: node.text.length,
      selectionAnchor: null,
      paragraph: null,
      textDirection: resolveNodeTextDirection(node)
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
    if (!s || !this.renderer) return
    s.paragraph?.delete()
    s.textDirection = resolveNodeTextDirection(node)
    s.paragraph = this.renderer.buildParagraph(node)
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

  selectLine(pos: number): void {
    const s = this._state
    if (!s?.paragraph) return
    const lineNum = s.paragraph.getLineNumberAt(pos)
    if (lineNum < 0) return
    const metrics = s.paragraph.getLineMetricsAt(lineNum)
    if (!metrics) return
    s.selectionAnchor = metrics.startIndex
    s.cursor = metrics.endExcludingWhitespaces
  }

  selectWordAt(x: number, y: number): void {
    const s = this._state
    if (!s?.paragraph) return
    const pos = s.paragraph.getGlyphPositionAtCoordinate(x, y).pos
    this.selectWord(pos)
  }

  selectLineAt(x: number, y: number): void {
    const s = this._state
    if (!s?.paragraph) return
    const pos = s.paragraph.getGlyphPositionAtCoordinate(x, y).pos
    this.selectLine(pos)
  }

  insert(text: string, node: SceneNode): void {
    const s = this._state
    if (!s) return
    const range = this.getSelectionRange() ?? [s.cursor, s.cursor]
    this.replaceRange(range[0], range[1], text)
    this.rebuildParagraph(node)
  }

  backspace(node: SceneNode): void {
    const s = this._state
    if (!s) return
    const range = this.getSelectionRange() ?? (s.cursor > 0 ? [s.cursor - 1, s.cursor] : null)
    if (range) this.replaceRange(range[0], range[1], '')
    this.rebuildParagraph(node)
  }

  delete(node: SceneNode): void {
    const s = this._state
    if (!s) return
    const range =
      this.getSelectionRange() ?? (s.cursor < s.text.length ? [s.cursor, s.cursor + 1] : null)
    if (range) this.replaceRange(range[0], range[1], '')
    this.rebuildParagraph(node)
  }

  private moveHorizontal(extend: boolean, visualDirection: 'left' | 'right'): void {
    const s = this._state
    if (!s) return
    if (!extend && this.collapseSelectionTo(visualDirection === 'left' ? 0 : 1)) return
    this.prepareMove(extend)
    const movesForward = (visualDirection === 'left') === (s.textDirection === 'RTL')
    const step = movesForward ? 1 : -1
    const next = s.cursor + step
    if (next >= 0 && next <= s.text.length) s.cursor = next
  }

  moveLeft(extend = false): void {
    this.moveHorizontal(extend, 'left')
  }

  moveRight(extend = false): void {
    this.moveHorizontal(extend, 'right')
  }

  private moveVertical(extend: boolean, edge: 'up' | 'down'): void {
    const s = this._state
    if (!s?.paragraph) return
    this.prepareMove(extend)
    const caret = this.getCaretRect()
    if (!caret) return
    const fontSize = s.paragraph.getLineMetrics()[0]?.height ?? 14
    const y = edge === 'up' ? caret.y0 - fontSize / 2 : caret.y1 + fontSize / 2
    s.cursor = s.paragraph.getGlyphPositionAtCoordinate(caret.x, y).pos
  }

  moveUp(extend = false): void {
    this.moveVertical(extend, 'up')
  }

  moveDown(extend = false): void {
    this.moveVertical(extend, 'down')
  }

  private moveToLineEdge(extend: boolean, edge: 'start' | 'end'): void {
    const s = this._state
    if (!s?.paragraph) return
    this.prepareMove(extend)
    const metrics = this.currentLineMetrics()
    if (!metrics) return
    const isRtlStart = s.textDirection === 'RTL' && edge === 'start'
    const isLtrEnd = s.textDirection !== 'RTL' && edge === 'end'
    s.cursor = isRtlStart || isLtrEnd ? metrics.endExcludingWhitespaces : metrics.startIndex
  }

  moveToLineStart(extend = false): void {
    this.moveToLineEdge(extend, 'start')
  }

  moveToLineEnd(extend = false): void {
    this.moveToLineEdge(extend, 'end')
  }

  private moveWord(extend: boolean, direction: 'left' | 'right'): void {
    const s = this.prepareMove(extend)
    if (!s) return
    const movingLeft = direction === 'left'
    let pos = this.skipWordBoundaryRun(s.text, s.cursor, movingLeft)
    pos = this.skipWordInteriorRun(s.text, pos, movingLeft)
    s.cursor = pos
  }

  private skipWordBoundaryRun(text: string, start: number, movingLeft: boolean): number {
    return this.advanceWhile(text, start, movingLeft, (boundary) => movingLeft === boundary)
  }

  private skipWordInteriorRun(text: string, start: number, movingLeft: boolean): number {
    return this.advanceWhile(text, start, movingLeft, (boundary) => movingLeft !== boundary)
  }

  private advanceWhile(
    text: string,
    start: number,
    movingLeft: boolean,
    shouldMove: (isBoundary: boolean) => boolean
  ): number {
    let pos = start
    const step = movingLeft ? -1 : 1
    while (movingLeft ? pos > 0 : pos < text.length) {
      const char = movingLeft ? text[pos - 1] : text[pos]
      if (!shouldMove(isWordBoundary(char))) break
      pos += step
    }
    return pos
  }

  moveWordLeft(extend = false): void {
    this.moveWord(extend, 'left')
  }

  moveWordRight(extend = false): void {
    this.moveWord(extend, 'right')
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
      useRight = s.textDirection === 'RTL'
    } else if (cursor >= text.length) {
      lo = text.length - 1
      hi = text.length
      useRight = s.textDirection !== 'RTL'
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
}

function isWordBoundary(ch: string): boolean {
  return /\s|[.,;:!?()[\]{}"'`<>/\\|@#$%^&*~+=\-_]/.test(ch)
}
