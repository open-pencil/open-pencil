const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g

export function placeholders(value: string): string[] {
  return [...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]).sort()
}

export function visibleTranslationText(value: string): string {
  return value.replaceAll(PLACEHOLDER_PATTERN, '')
}

export function hasMixedLatinAndCjk(value: string): boolean {
  const visibleText = visibleTranslationText(value)
  return (
    /\p{Script=Latin}/u.test(visibleText) &&
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(visibleText)
  )
}

/** A modifier joined to a key (`Alt+Enter`, `Strg+S`) or a modifier glyph (`⌘`, `⌥`). */
const SHORTCUT_TEXT_PATTERN =
  /\b(?:Ctrl|Control|Strg|Alt|Option|Shift|Maj|Umschalt|Cmd|Command|Win|Super)\s*\+\s*\S|[⌘⌥⇧⌃]/u

/**
 * Whether a message spells out a keyboard shortcut. Shortcuts are tokens formatted for the
 * platform (`formatShortcut`) and passed in as a placeholder, so their key and label agree.
 */
export function hasShortcutText(value: string): boolean {
  return SHORTCUT_TEXT_PATTERN.test(visibleTranslationText(value))
}
