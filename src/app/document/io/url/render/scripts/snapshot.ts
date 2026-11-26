/**
 * The page snapshot script the desktop app runs in a page it renders in a hidden webview, imported
 * as `?script`: it runs in the page, with only the page's globals, and the app reads its default export.
 */

/**
 * Writes the CSS the page's scripts left into the copy's style elements: rules inserted with
 * `insertRule`, sheets the page turned off left out, and adopted sheets after the document's own.
 */
function copyStylesheets(live: HTMLElement, copy: HTMLElement): void {
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
    const copied = copiedStyles.at(index)
    // A sheet the page turned off has no markup that says so; it is left out instead.
    if (style.sheet?.disabled) copied?.remove()
    const rules = rulesOf(style.sheet)
    if (rules !== null && copied) copied.textContent = rules
  }
  const liveLinks = Array.from(live.querySelectorAll('link'))
  const copiedLinks = Array.from(copy.querySelectorAll('link'))
  for (const [index, link] of liveLinks.entries()) {
    if (link.sheet?.disabled) copiedLinks.at(index)?.remove()
  }
  const head = copy.querySelector('head') ?? copy
  // Adopted sheets apply after the document's own, so they are written after all of those.
  const end = copy.querySelector('body') ?? head
  for (const sheet of document.adoptedStyleSheets) {
    if (sheet.disabled) continue
    const rules = rulesOf(sheet)
    if (rules === null) continue
    const style = document.createElement('style')
    style.textContent = rules
    end.append(style)
  }
}

/**
 * The page as its scripts left it, as HTML a static import reads: CSS rules scripts inserted with
 * `insertRule` or adopted as constructed sheets written into style elements, what form fields
 * hold written into their attributes, `<script>` and `<noscript>` left out, since the import runs
 * no script and would show what `<noscript>` holds, and a `<base>` that resolves its addresses as
 * the page did.
 */
function pageSnapshot(): { html: string; url: string } {
  const live = document.documentElement
  const copy = live.cloneNode(true)
  if (!(copy instanceof HTMLElement)) return { html: live.outerHTML, url: location.href }

  copyStylesheets(live, copy)
  const head = copy.querySelector('head') ?? copy

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

/** The snapshot, which the desktop app reads once the bundled script has run. */
export default pageSnapshot()
