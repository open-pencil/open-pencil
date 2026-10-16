/** The source spelling stays intact when a reference is displayed as an atomic pill. */
export interface FormulaPill {
  label: string
  displayValue: string
}

export interface FormulaSelection {
  start: number
  end: number
}

export function formulaFieldText(node: Node): string {
  if (node instanceof HTMLElement && node.dataset.reference !== undefined)
    return node.dataset.reference
  // Contenteditable inserts non-breaking spaces to preserve typed whitespace.
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? '').replaceAll('\u00a0', ' ')
  if (node.nodeName === 'BR') return '\n'
  return [...node.childNodes].map(formulaFieldText).join('')
}

export function formulaFieldSelection(root: HTMLElement): FormulaSelection | null {
  const selection = root.ownerDocument.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const prefix = range.cloneRange()
  prefix.selectNodeContents(root)
  prefix.setEnd(range.startContainer, range.startOffset)
  const start = formulaFieldText(prefix.cloneContents()).length
  prefix.setEnd(range.endContainer, range.endOffset)
  return { start, end: formulaFieldText(prefix.cloneContents()).length }
}

export function selectFormulaField(root: HTMLElement, start: number, end = start) {
  const locate = (offset: number, parent: Node = root): [Node, number] => {
    let remaining = offset
    for (const [index, child] of [...parent.childNodes].entries()) {
      const length = formulaFieldText(child).length
      if (remaining <= length) {
        if (child.nodeType === Node.TEXT_NODE) return [child, remaining]
        if (child instanceof HTMLElement && child.dataset.reference !== undefined)
          return [parent, index + (remaining > 0 ? 1 : 0)]
        if (child.nodeName === 'BR') return [parent, index + (remaining > 0 ? 1 : 0)]
        if (child.childNodes.length) return locate(remaining, child)
        if (length === 0) continue
      }
      remaining -= length
    }
    return [parent, parent.childNodes.length]
  }
  const range = root.ownerDocument.createRange()
  range.setStart(...locate(start))
  range.setEnd(...locate(end))
  const selection = root.ownerDocument.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export interface FormulaSegment extends FormulaSelection {
  source: string
  pill?: FormulaPill
}

/** Keep offsets in source coordinates, even when a reference is displayed as a pill. */
export function formulaSegments(
  source: string,
  resolve: (reference: string) => FormulaPill | undefined
) {
  const segments: FormulaSegment[] = []
  let start = 0
  for (const match of source.matchAll(/\{[^{}]+\}/g)) {
    const pill = resolve(match[0])
    if (!pill) continue
    if (start < match.index)
      segments.push({ source: source.slice(start, match.index), start, end: match.index })
    const end = match.index + match[0].length
    segments.push({ source: match[0], start: match.index, end, pill })
    start = end
  }
  segments.push({ source: source.slice(start), start, end: source.length })
  return segments
}
