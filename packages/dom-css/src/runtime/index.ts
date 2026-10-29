import type { CSSRuntime } from '../types'
import { createBrowserCSSRuntime } from './browser'
import { createHeadlessCSSRuntime } from './headless/runtime'

export { createBrowserCSSRuntime } from './browser'
export type { BrowserCSSRuntimeOptions } from './browser'
export { createHeadlessCSSRuntime } from './headless/runtime'

export function createCSSRuntime(): CSSRuntime {
  return typeof document !== 'undefined' ? createBrowserCSSRuntime() : createHeadlessCSSRuntime()
}
