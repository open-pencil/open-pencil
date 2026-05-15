export type TestId = string

export type TestIdProps = {
  testId?: TestId
}

export type RequiredTestIdProps = {
  testId: TestId
}

export type WithTestId<TProps extends object = object> = TProps & TestIdProps

export type WithRequiredTestId<TProps extends object = object> = TProps & RequiredTestIdProps

export type WithoutTestId<TProps extends object> = Omit<TProps, keyof TestIdProps>

export function testId(id?: TestId | null): { 'data-test-id'?: TestId } {
  return id ? { 'data-test-id': id } : {}
}

export function testIdSelector(id: TestId): string {
  return `[data-test-id="${cssEscape(id)}"]`
}

function cssEscape(value: string): string {
  return CSS.escape(value)
}
