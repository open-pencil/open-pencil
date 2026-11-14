import type { CSSRuntime } from '../types'
import { createBrowserCSSRuntime } from './browser'

export { createBrowserCSSRuntime } from './browser'
export type { BrowserCSSRuntimeOptions } from './browser'

/**
 * The browser's CSS runtime. Outside a browser there is none to default to: pass a runtime, such
 * as `createHTMLEngineRuntime()` from `@open-pencil/html-engine`, which styles and lays documents
 * out as a browser does.
 */
export function createCSSRuntime(): CSSRuntime {
  if (typeof document !== 'undefined') return createBrowserCSSRuntime()
  throw new Error(
    'No CSS runtime outside a browser: pass `runtime`, such as createHTMLEngineRuntime() from @open-pencil/html-engine'
  )
}
