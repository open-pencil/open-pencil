/**
 * Scripts the desktop app runs inside a page it renders in a hidden webview. Each is sent as its
 * own source text and runs in the page, not in the app: it may use only the page's globals and
 * nothing imported, and it must not await, since the webview returns a script's value at once.
 * Their value comes back as JSON.
 */

/**
 * Whether the page has loaded with its fonts, and how many changes its document has had, which a
 * page that builds itself with scripts keeps making until it is done. Counts from the first call.
 */
export function pageSettling(): { ready: boolean; changes: number } {
  // Where the count is kept between calls: the script carries nothing from one run to the next.
  const key = '__openPencilDocumentChanges'
  const kept: unknown = Reflect.get(window, key)
  let changes = 0
  if (
    typeof kept === 'object' &&
    kept !== null &&
    'count' in kept &&
    typeof kept.count === 'number'
  ) {
    changes = kept.count
  } else {
    const counter = { count: 0 }
    new MutationObserver((records) => {
      counter.count += records.length
    }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true })
    Reflect.set(window, key, counter)
  }
  return {
    ready: document.readyState === 'complete' && document.fonts.status === 'loaded',
    changes
  }
}

/**
 * The page as its scripts left it, as HTML a static import reads: CSS rules scripts inserted with
 * `insertRule` or adopted as constructed sheets written into style elements, what form fields
 * hold written into their attributes, `<script>` and `<noscript>` left out, since the import runs
 * no script and would show what `<noscript>` holds, and a `<base>` that resolves its addresses as
 * the page did.
 */
export function pageSnapshot(): { html: string; url: string } {
  const live = document.documentElement
  const copy = live.cloneNode(true)
  if (!(copy instanceof HTMLElement)) return { html: live.outerHTML, url: location.href }

  const rulesOf = (sheet: CSSStyleSheet | null): string | null => {
    if (!sheet) return null
    try {
      return Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n')
    } catch {
      return null
    }
  }
  const liveStyles = Array.from(live.querySelectorAll('style'))
  const copiedStyles = Array.from(copy.querySelectorAll('style'))
  for (const [index, style] of liveStyles.entries()) {
    const rules = rulesOf(style.sheet)
    const copied = copiedStyles.at(index)
    if (rules !== null && copied) copied.textContent = rules
  }
  const head = copy.querySelector('head') ?? copy
  for (const sheet of document.adoptedStyleSheets) {
    const rules = rulesOf(sheet)
    if (rules === null) continue
    const style = document.createElement('style')
    style.textContent = rules
    head.append(style)
  }

  // What a field holds, written where the copy's markup shows it.
  const copyValue = (field: Element, copied: Element) => {
    if (field instanceof HTMLInputElement) {
      if (field.type === 'checkbox' || field.type === 'radio') {
        copied.toggleAttribute('checked', field.checked)
      } else if (field.type !== 'password' && field.type !== 'file') {
        copied.setAttribute('value', field.value)
      }
    } else if (field instanceof HTMLTextAreaElement) {
      copied.textContent = field.value
    } else if (field instanceof HTMLSelectElement) {
      const copiedOptions = Array.from(copied.querySelectorAll('option'))
      for (const [at, option] of Array.from(field.options).entries()) {
        copiedOptions.at(at)?.toggleAttribute('selected', option.selected)
      }
    }
  }
  const liveFields = Array.from(live.querySelectorAll('input, textarea, select'))
  const copiedFields = Array.from(copy.querySelectorAll('input, textarea, select'))
  for (const [index, field] of liveFields.entries()) {
    const copied = copiedFields.at(index)
    if (copied) copyValue(field, copied)
  }

  for (const element of Array.from(copy.querySelectorAll('script, noscript, base'))) {
    element.remove()
  }
  const base = document.createElement('base')
  base.href = document.baseURI
  head.prepend(base)

  const doctype = document.doctype ? '<!doctype html>' : ''
  return { html: doctype + copy.outerHTML, url: location.href }
}

/** A script that runs `script` in the page and gives back its value. */
export function pageScript(script: () => unknown): string {
  return `(${String(script)})()`
}
