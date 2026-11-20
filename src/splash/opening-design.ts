// Keeps the boot splash over the app while a `/design/<id>` address opens its design, so the
// person sees the splash and then the design, never Home in between.
import './opening-design.css'

/** Set on the root element while the splash waits for the design; `opening-design.css` reads it. */
const OPENING_DESIGN_ATTRIBUTE = 'data-opening-design'

const DESIGN_ADDRESS = /^\/design\/[^/]+\/?$/

/** Holds the splash when the page loads on a design's address; runs in the page's head. */
export function holdSplashForDesign(pathname: string): void {
  if (DESIGN_ADDRESS.test(pathname)) {
    document.documentElement.setAttribute(OPENING_DESIGN_ATTRIBUTE, '')
  }
}

/** Lets the splash go once the design has opened, or once there is none to open. */
export function releaseSplashForDesign(): void {
  document.documentElement.removeAttribute(OPENING_DESIGN_ATTRIBUTE)
}
