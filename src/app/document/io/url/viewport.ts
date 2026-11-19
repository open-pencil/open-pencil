import { HTML_IMPORT_VIEWPORT } from '@open-pencil/core/io/formats/html/layers'
import type { DesignViewport } from '@open-pencil/dom-css'

/** The window sizes a web page can be opened at, as the devices that show it. */
export const WEB_PAGE_SIZES = ['desktop', 'tablet', 'mobile'] as const

export type WebPageSize = (typeof WEB_PAGE_SIZES)[number]

/** The window each size lays a page out in: a laptop's, an iPad's in portrait, an iPhone's. */
export const WEB_PAGE_VIEWPORTS: Readonly<Record<WebPageSize, DesignViewport>> = {
  desktop: HTML_IMPORT_VIEWPORT,
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 }
}
