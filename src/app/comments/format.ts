/**
 * Figma's comment formatting, written as Markdown into the plain text a comment stores: bold,
 * italic and strikethrough wrap the selection, a link wraps it as the link text, and the list
 * commands start or continue a numbered or bulleted list.
 */
export type CommentFormat = 'bold' | 'italic' | 'strikethrough' | 'link' | 'numbered' | 'bulleted'

export interface CommentEdit {
  value: string
  start: number
  end: number
}

const WRAPS = {
  bold: '**',
  italic: '*',
  strikethrough: '~~'
} as const satisfies Partial<Record<CommentFormat, string>>

const LIST_ITEM = /^(\s*)(?:(\d+)\.|[-*])\s/u

/** The format a key press asks for, with Figma's shortcuts; `mod` is Cmd on a Mac, Ctrl elsewhere. */
export function commentFormatForKey(event: {
  code: string
  shiftKey: boolean
  altKey: boolean
  mod: boolean
}): CommentFormat | null {
  if (!event.mod || event.altKey) return null
  if (event.shiftKey) {
    if (event.code === 'KeyX') return 'strikethrough'
    if (event.code === 'Digit7') return 'numbered'
    if (event.code === 'Digit8') return 'bulleted'
    return null
  }
  if (event.code === 'KeyB') return 'bold'
  if (event.code === 'KeyI') return 'italic'
  if (event.code === 'KeyK') return 'link'
  return null
}

function lineStart(value: string, at: number) {
  return value.lastIndexOf('\n', at - 1) + 1
}

function lineEnd(value: string, at: number) {
  const end = value.indexOf('\n', at)
  return end === -1 ? value.length : end
}

function wrap({ value, start, end }: CommentEdit, mark: string): CommentEdit {
  const selected = value.slice(start, end)
  const before = value.slice(start - mark.length, start)
  const after = value.slice(end, end + mark.length)
  // Pressing the shortcut again on wrapped text unwraps it.
  if (before === mark && after === mark) {
    return {
      value: value.slice(0, start - mark.length) + selected + value.slice(end + mark.length),
      start: start - mark.length,
      end: end - mark.length
    }
  }
  return {
    value: `${value.slice(0, start)}${mark}${selected}${mark}${value.slice(end)}`,
    start: start + mark.length,
    end: end + mark.length
  }
}

function link({ value, start, end }: CommentEdit): CommentEdit {
  const text = value.slice(start, end)
  // The placeholder URL is selected so typing replaces it; without link text the address is
  // shown as it is.
  if (text === '') {
    return {
      value: `${value.slice(0, start)}<url>${value.slice(end)}`,
      start: start + 1,
      end: start + 4
    }
  }
  const inserted = `[${text}](url)`
  const url = start + text.length + 3
  return {
    value: value.slice(0, start) + inserted + value.slice(end),
    start: url,
    end: url + 3
  }
}

function list({ value, start, end }: CommentEdit, numbered: boolean): CommentEdit {
  const from = lineStart(value, start)
  const to = lineEnd(value, end)
  const lines = value.slice(from, to).split('\n')
  const listed = lines.every((line) => LIST_ITEM.test(line))
  // Turning the same kind of list on again takes the markers off.
  const sameKind = listed && lines.every((line) => /^\s*\d+\.\s/u.test(line) === numbered)
  const next = lines.map((line, index) => {
    const bare = line.replace(LIST_ITEM, '$1')
    if (sameKind) return bare
    return `${numbered ? `${index + 1}.` : '-'} ${bare}`
  })
  const text = next.join('\n')
  const result = value.slice(0, from) + text + value.slice(to)
  // A caret on one line keeps its place in the text; a selection covers the changed lines.
  if (start === end && lines.length === 1) {
    const caret = Math.max(from, start + text.length - (to - from))
    return { value: result, start: caret, end: caret }
  }
  return { value: result, start: from, end: from + text.length }
}

/** Applies a format to the text and selection of a comment being written. */
export function formatComment(edit: CommentEdit, format: CommentFormat): CommentEdit {
  if (format === 'link') return link(edit)
  if (format === 'numbered') return list(edit, true)
  if (format === 'bulleted') return list(edit, false)
  return wrap(edit, WRAPS[format])
}

/**
 * Shift+Enter inside a list item starts the next item, as in Figma; on an empty item it ends the
 * list instead. Returns null outside a list, where Shift+Enter is a plain line break.
 */
export function continueList({ value, start, end }: CommentEdit): CommentEdit | null {
  const from = lineStart(value, start)
  const match = LIST_ITEM.exec(value.slice(from, lineEnd(value, start)))
  if (!match) return null
  const marker = match[0]
  const indent = /^\s*/u.exec(marker)?.[0] ?? ''
  if (value.slice(from, lineEnd(value, start)).length === marker.length) {
    return {
      value: value.slice(0, from) + value.slice(from + marker.length),
      start: from,
      end: from
    }
  }
  const number = Number.parseInt(marker, 10)
  const nextMarker = Number.isNaN(number) ? `${indent}- ` : `${indent}${number + 1}. `
  const inserted = `\n${nextMarker}`
  const at = start + inserted.length
  return { value: value.slice(0, start) + inserted + value.slice(end), start: at, end: at }
}

/** A comment's text without its Markdown, for the one-paragraph preview in the comments list. */
export function commentPreview(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/(\*\*|~~|\*|~)(\S(?:.*?\S)?)\1/gu, '$2')
    .replace(/^\s*(?:\d+\.|[-*])\s+/gmu, '')
    .replace(/\s*\n\s*/gu, ' ')
    .trim()
}
