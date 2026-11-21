// Keeps the boot splash over the app while a `/design/<id>` address opens its design and the
// designs the browser tab had open come back, so the person sees the splash and then the design,
// never Home or tabs appearing one by one in between.
import './opening-design.css'

/** Set on the root element while the splash waits for the design; `opening-design.css` reads it. */
const OPENING_DESIGN_ATTRIBUTE = 'data-opening-design'

const DESIGN_ADDRESS = /^\/design\/[^/]+\/?$/

/**
 * Holds the splash when the page loads on a design's address, or with designs the browser tab had
 * open to reopen (`src/app/tabs/kept/`); runs in the page's head.
 */
export function holdSplashForDesign(pathname: string, keptTabs: boolean): void {
  if (keptTabs || DESIGN_ADDRESS.test(pathname)) {
    document.documentElement.setAttribute(OPENING_DESIGN_ATTRIBUTE, '')
  }
}

/** Lets the splash go once the design has opened, or once there is none to open. */
export function releaseSplashForDesign(): void {
  document.documentElement.removeAttribute(OPENING_DESIGN_ATTRIBUTE)
}
