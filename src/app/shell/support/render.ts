import { IS_TAURI } from '@open-pencil/core/constants'

import type { SupportNotice } from './guidance'

/**
 * Root element the notice replaces. It is the app mount point, so the notice
 * takes over whatever the splash or a half-mounted app left behind.
 */
const APP_ROOT_SELECTOR = '#app'
export const BOOT_NOTICE_ID = 'boot-notice'

function openExternally(event: MouseEvent, href: string): void {
  // The desktop WebView must not navigate away from the app; hand links to the OS.
  if (!IS_TAURI) return
  event.preventDefault()
  void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(href))
}

function createLink(doc: Document, label: string, href: string): HTMLAnchorElement {
  const anchor = doc.createElement('a')
  anchor.href = href
  anchor.target = '_blank'
  anchor.rel = 'noreferrer'
  anchor.textContent = label
  anchor.addEventListener('click', (event) => openExternally(event, href))
  return anchor
}

/**
 * Render a support notice with plain DOM into the app root. Runs before Vue,
 * Tailwind, and the i18n catalogs load, so it relies only on the inline
 * `#boot-notice` styles in `index.html`.
 */
export function renderSupportNotice(notice: SupportNotice, doc: Document = document): void {
  const root = doc.querySelector(APP_ROOT_SELECTOR) ?? doc.body
  root.replaceChildren()

  const container = doc.createElement('section')
  container.id = BOOT_NOTICE_ID
  container.setAttribute('role', 'alert')

  const icon = doc.createElement('img')
  icon.src = '/brand/app-icon.svg'
  icon.alt = ''
  icon.width = 40
  icon.height = 40
  container.append(icon)

  const heading = doc.createElement('h1')
  heading.textContent = notice.heading
  container.append(heading)

  for (const text of notice.paragraphs) {
    const paragraph = doc.createElement('p')
    paragraph.textContent = text
    container.append(paragraph)
  }

  const links = doc.createElement('nav')
  notice.links.forEach((link, index) => {
    if (index > 0) links.append(doc.createTextNode(' · '))
    links.append(createLink(doc, link.label, link.url))
  })
  container.append(links)

  if (notice.details.length > 0) {
    const details = doc.createElement('details')
    const summary = doc.createElement('summary')
    summary.textContent = 'Details'
    const pre = doc.createElement('pre')
    pre.textContent = notice.details.join('\n')
    details.append(summary, pre)
    container.append(details)
  }

  root.append(container)
}
