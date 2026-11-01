export type ReloadStorage = Pick<Storage, 'getItem' | 'setItem'>

/** The tab's session storage, or null when the browser withholds it. */
export function sessionStore(): ReloadStorage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}
