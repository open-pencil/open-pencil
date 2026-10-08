export function expectDefined<T>(value: T | null | undefined, label = 'value'): NonNullable<T> {
  if (value == null) throw new Error(`${label} was expected to be defined`)
  return value
}
