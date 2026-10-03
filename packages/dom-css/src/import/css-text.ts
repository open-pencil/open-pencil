export function mergeCSSText(...parts: Array<string | undefined>): string | undefined {
  const text = parts.map((part) => part?.trim()).filter((part): part is string => !!part)
  return text.length > 0 ? text.join('\n') : undefined
}
