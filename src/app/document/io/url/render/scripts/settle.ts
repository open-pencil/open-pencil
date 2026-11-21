/**
 * The settling script the desktop app runs in a page it renders in a hidden webview, again and
 * again until the page is quiet, imported as `?script`: it runs in the page, with only the page's
 * globals, and the app reads its default export.
 */

/** What the page has done since the script first ran in it, kept on its window between runs. */
interface Activity {
  /** Changes to the document and requests finished, which stop once the page has built itself. */
  count: number
}

/** Where the activity is kept between runs: each run of the script starts from nothing. */
const ACTIVITY_KEY = '__openPencilPageActivity'

function isActivity(value: unknown): value is Activity {
  return typeof value === 'object' && value !== null && 'count' in value
}

/** The page's activity, counted from the first run on by observers it starts then. */
function activity(): Activity {
  const kept: unknown = Reflect.get(window, ACTIVITY_KEY)
  if (isActivity(kept)) return kept
  const counted: Activity = { count: 0 }
  new MutationObserver((records) => {
    counted.count += records.length
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
  // Every request the page finishes, however many it makes: the timing buffer it would otherwise
  // be read from holds only so many.
  new PerformanceObserver((list) => {
    counted.count += list.getEntries().length
  }).observe({ type: 'resource', buffered: true })
  Reflect.set(window, ACTIVITY_KEY, counted)
  return counted
}

/**
 * Whether the page has loaded with its fonts, how much it has done, and which document it is, as
 * its time origin tells one document from the next after a navigation.
 */
function pageSettling(): { ready: boolean; changes: number; document: number } {
  return {
    ready: document.readyState === 'complete' && document.fonts.status === 'loaded',
    changes: activity().count,
    document: performance.timeOrigin
  }
}

/** The page's state, which the desktop app reads once the bundled script has run. */
export default pageSettling()
