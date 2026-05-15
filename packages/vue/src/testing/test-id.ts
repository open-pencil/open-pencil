export type TestId = string

export type TestIdProps = {
  testId?: TestId
}

export function testId(id?: TestId | null): { 'data-test-id'?: TestId } {
  return id ? { 'data-test-id': id } : {}
}

export function testIdSelector(id: TestId): string {
  return `[data-test-id="${cssEscape(id)}"]`
}

function cssEscape(value: string): string {
  return CSS.escape(value)
}
