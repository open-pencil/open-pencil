import { ErrorCodes, type App } from 'vue'

/**
 * Vue error sources whose failure during the first render leaves the initial
 * view missing. Hooks and event handlers that throw later degrade the app but
 * still show it, so they stay with the regular toast error handling.
 */
const FATAL_BOOT_ERROR_CODES: ReadonlySet<ErrorCodes> = new Set([
  ErrorCodes.SETUP_FUNCTION,
  ErrorCodes.RENDER_FUNCTION,
  ErrorCodes.ASYNC_COMPONENT_LOADER,
  ErrorCodes.SCHEDULER,
  ErrorCodes.COMPONENT_UPDATE
])

/** Development-build `info` strings for the codes above, in the same order. */
const FATAL_BOOT_ERROR_INFO: ReadonlySet<string> = new Set([
  'setup function',
  'render function',
  'async component loader',
  'scheduler flush',
  'component update'
])

/**
 * Production builds pass the error reference URL instead of the info string;
 * its fragment carries the numeric code.
 */
const PRODUCTION_ERROR_INFO = /#runtime-(\d+)$/

export function isFatalBootErrorInfo(info: string): boolean {
  if (FATAL_BOOT_ERROR_INFO.has(info)) return true
  const match = PRODUCTION_ERROR_INFO.exec(info)
  return match !== null && FATAL_BOOT_ERROR_CODES.has(Number(match[1]))
}

export interface BootFailure {
  readonly error: unknown
}

export interface BootErrorObserver {
  /** Restore the previous handler and return the first fatal error, if any. */
  stop(): BootFailure | undefined
}

/**
 * Capture render-blocking errors between `createApp()` and the first settled
 * route. Vue reports component errors through `errorHandler` rather than the
 * window, so without this a failed initial render is only a console entry and
 * a blank window.
 */
export function observeBootErrors(app: App): BootErrorObserver {
  const previous = app.config.errorHandler
  let failure: BootFailure | undefined
  app.config.errorHandler = (error, instance, info) => {
    if (!failure && isFatalBootErrorInfo(info)) failure = { error }
    if (previous) previous(error, instance, info)
    else console.error(error)
  }
  return {
    stop() {
      app.config.errorHandler = previous
      return failure
    }
  }
}
