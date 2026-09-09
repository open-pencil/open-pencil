import * as v from 'valibot'

const registryErrorSchema = v.object({ error: v.object({ code: v.string() }) })
const registryVersionSchema = v.pipe(v.string(), v.nonEmpty())

export function isRegistryNotFound(text: string): boolean {
  try {
    const parsed = v.safeParse(registryErrorSchema, JSON.parse(text))
    return parsed.success && parsed.output.error.code === 'E404'
  } catch {
    return false // Non-JSON output is not evidence that a version is absent.
  }
}

export function validateRegistryVersion(text: string, expected: string): void {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('npm view: invalid JSON')
  }
  const parsed = v.safeParse(registryVersionSchema, value)
  if (!parsed.success || parsed.output !== expected) {
    throw new Error(`npm view: expected version ${expected}`)
  }
}
