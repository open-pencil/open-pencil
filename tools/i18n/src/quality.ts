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
