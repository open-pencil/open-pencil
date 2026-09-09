function isJSONObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseJSONObject(text: string, context: string): Record<string, unknown> {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error(`${context}: invalid JSON`)
  }
  if (!isJSONObject(value)) {
    throw new Error(`${context}: expected an object`)
  }
  return value
}

export function parseNpmPack(text: string): { filename: string; files: string[] } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('npm pack: invalid JSON')
  }
  if (!Array.isArray(value) || value.length !== 1) throw new Error('npm pack: expected one result')
  const result: unknown = value[0]
  if (
    !result ||
    typeof result !== 'object' ||
    !('filename' in result) ||
    typeof result.filename !== 'string' ||
    !/^[^/\\]+\.tgz$/.test(result.filename) ||
    !('files' in result) ||
    !Array.isArray(result.files)
  ) {
    throw new Error('npm pack: expected an archive filename and file listing')
  }
  const files = result.files.map((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      !('path' in entry) ||
      typeof entry.path !== 'string' ||
      !entry.path ||
      entry.path.startsWith('/') ||
      entry.path.includes('\\') ||
      entry.path.split('/').some((part) => part === '..' || part === '.')
    ) {
      throw new Error('npm pack: invalid file path')
    }
    return entry.path
  })
  return { filename: result.filename, files }
}
