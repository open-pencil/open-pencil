/**
 * The parts of a Markdown link that app text writes to stand for something, as chat references
 * and comment mentions do: a label safe inside `[…]`, a target read back from its URL, and an
 * attribute of the inline component it renders as.
 */

/** A link label with `\`, `[` and `]` escaped and its whitespace on one line. */
export function escapeLinkLabel(label: string): string {
  return label.replace(/[\\[\]]/g, '\\$&').replace(/\s+/g, ' ')
}

export function unescapeLinkLabel(label: string): string {
  return label.replace(/\\(.)/g, '$1')
}

/** A link target's ID as written into its URL, or null for a broken escape. */
export function decodeLinkTarget(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return null
  }
}

/** A value as an inline component's attribute writes it, `name="…"`. */
export function componentAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}
