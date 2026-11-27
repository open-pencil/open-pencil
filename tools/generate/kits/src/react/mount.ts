import { Window } from 'happy-dom'
import type { ReactElement } from 'react'

/** Globals Node has that a page must see as the browser's own. */
const BROWSER_OWNED = new Set([
  'window',
  'document',
  'navigator',
  'location',
  'self',
  'top',
  'parent'
])

/**
 * Gives this realm a browser's globals from a happy-dom window, as a kit's components see them
 * once an app mounts: every property of the window Node lacks, as happy-dom's global registrator
 * sets them, and the window's own `window` and `document`. It runs in the render worker, whose
 * realm ends with the render.
 */
export function installBrowserGlobals(): void {
  const window = new Window({ url: 'http://localhost/' })
  for (const name of Object.getOwnPropertyNames(window)) {
    if (name in globalThis && !BROWSER_OWNED.has(name)) continue
    const value = name === 'window' || name === 'self' ? window : Reflect.get(window, name)
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true })
  }
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true })
}

/**
 * The markup a React element mounts to once its effects have run, as a browser shows it: what
 * a primitive measures or registers on mount, such as a slider's thumb, is in place.
 */
export async function mountedMarkup(element: ReactElement): Promise<string> {
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  await act(async () => root.render(element))
  const html = container.innerHTML
  await act(async () => root.unmount())
  return html
}
