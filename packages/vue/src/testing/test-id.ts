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

export function toolbarToolTestId(tool: string, mobile = false): TestId {
  return `${mobile ? 'mobile-' : ''}toolbar-tool-${tool.toLowerCase()}`
}

export function toolbarFlyoutTestId(tool: string, mobile = false): TestId {
  return `${mobile ? 'mobile-' : ''}toolbar-flyout-${tool.toLowerCase()}`
}

export function toolbarFlyoutItemTestId(tool: string, mobile = false): TestId {
  return `${mobile ? 'mobile-' : ''}toolbar-flyout-item-${tool.toLowerCase()}`
}

export function variablesAddTestId(type: string): TestId {
  return `variables-add-${type.toLowerCase()}`
}

export function acpPermissionOptionTestId(kind: string): TestId {
  return `acp-permission-option-${kind}`
}

function cssEscape(value: string): string {
  return CSS.escape(value)
}
