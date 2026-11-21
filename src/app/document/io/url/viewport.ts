import type { DesignViewport } from '@open-pencil/dom-css'

/** The window sizes a web page can be opened at, as the devices that show it. */
export const WEB_PAGE_SIZES = ['desktop', 'tablet', 'mobile'] as const

export type WebPageSize = (typeof WEB_PAGE_SIZES)[number]

/**
 * The window each size lays a page out in: the importer's own, a laptop's, for the desktop, so
 * it is read when the importer loads rather than with the editor; an iPad's in portrait; an
 * iPhone's.
 */
export const WEB_PAGE_VIEWPORTS: Readonly<Record<WebPageSize, DesignViewport | undefined>> = {
  desktop: undefined,
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }
}
