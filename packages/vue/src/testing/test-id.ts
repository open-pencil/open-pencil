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

type CssEscapeRuntime = {
  CSS?: {
    escape?: (value: string) => string
  }
}

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
  const runtime = globalThis as CssEscapeRuntime
  const nativeEscape = runtime.CSS?.escape
  if (typeof nativeEscape === 'function') {
    return nativeEscape(value)
  }

  return cssEscapeFallback(value)
}

function cssEscapeFallback(value: string): string {
  let escaped = ''

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index)
    if (codePoint === undefined) {
      break
    }

    const character = String.fromCodePoint(codePoint)
    const nextIndex = index + character.length
    const isFirst = index === 0
    const isSecondAfterHyphen = index === 1 && value.charCodeAt(0) === 0x002d

    if (codePoint === 0x0000) {
      escaped += '\uFFFD'
    } else if (
      isControlCodePoint(codePoint) ||
      (isFirst && isDigitCodePoint(codePoint)) ||
      (isSecondAfterHyphen && isDigitCodePoint(codePoint))
    ) {
      escaped += `\\${codePoint.toString(16)} `
    } else if (isFirst && codePoint === 0x002d && nextIndex >= value.length) {
      escaped += '\\-'
    } else if (isSafeIdentifierCodePoint(codePoint)) {
      escaped += character
    } else {
      escaped += `\\${character}`
    }

    index = nextIndex
  }

  return escaped
}

function isControlCodePoint(codePoint: number): boolean {
  return (codePoint >= 0x0001 && codePoint <= 0x001f) || codePoint === 0x007f
}

function isDigitCodePoint(codePoint: number): boolean {
  return codePoint >= 0x0030 && codePoint <= 0x0039
}

function isSafeIdentifierCodePoint(codePoint: number): boolean {
  return (
    codePoint >= 0x0080 ||
    codePoint === 0x002d ||
    codePoint === 0x005f ||
    isDigitCodePoint(codePoint) ||
    (codePoint >= 0x0041 && codePoint <= 0x005a) ||
    (codePoint >= 0x0061 && codePoint <= 0x007a)
  )
}
