import {
  generateFaviconFiles,
  initFaviconIconSettings,
  stringToSvg as stringToSVG
} from '@realfavicongenerator/generate-favicon'
import sharp from 'sharp'

import { appArtwork, loadArtwork, recolor } from './artwork.ts'

export type BrandFiles = Map<string, Buffer>

export async function generateWeb(root: string): Promise<BrandFiles> {
  const { adapter, main, micro } = await loadArtwork(root)
  const darkMicro = recolor(micro, adapter, 'dark')
  const app = appArtwork(main, adapter, 'web')
  const tile = appArtwork(main, adapter, 'tile')
  const favicon = appArtwork(micro, adapter, 'tile')
  const maskable = appArtwork(main, adapter, 'maskable')
  const icon = initFaviconIconSettings()
  icon.desktop.darkIconType = 'specific'
  // Use precomposed tiles with no generator background/clip transforms. This also
  // avoids SVG.js process-global clip IDs leaking into reproducible output.
  icon.touch.icon = stringToSVG(app, adapter)
  icon.webAppManifest.icon = stringToSVG(maskable, adapter)
  const generated = await generateFaviconFiles(
    { icon: stringToSVG(favicon, adapter), darkIcon: stringToSVG(favicon, adapter) },
    { icon, path: '/brand/', skipMetadataInjection: true },
    adapter
  )
  const files: BrandFiles = new Map()
  for (const [name, content] of Object.entries(generated)) {
    // VitePWA owns the application's manifest; the docs are not an installable app.
    if (name === 'site.webmanifest' || name === 'web-app-manifest-192x192.png') continue
    let path = `brand/${name}`
    if (name === 'favicon.ico' || name === 'apple-touch-icon.png') path = name
    if (name === 'web-app-manifest-512x512.png') path = 'brand/pwa-maskable-512.png'
    files.set(
      path,
      content instanceof Blob ? Buffer.from(await content.arrayBuffer()) : Buffer.from(content)
    )
  }
  files.set('brand/app-icon.svg', Buffer.from(tile))
  files.set('brand/app-icon-1024.png', await sharp(Buffer.from(tile)).png().toBuffer())
  files.set('brand/mark.svg', Buffer.from(main))
  files.set('brand/mark-dark.svg', Buffer.from(recolor(main, adapter, 'dark')))
  files.set('brand/mark-micro.svg', Buffer.from(micro))
  files.set('brand/mark-micro-dark.svg', Buffer.from(darkMicro))
  files.set('brand/mark-mono.svg', Buffer.from(recolor(main, adapter, 'mono')))
  files.set('brand/mark-mono-dark.svg', Buffer.from(recolor(main, adapter, 'mono-dark')))
  for (const size of [192, 512]) {
    files.set(
      `brand/pwa-${size}.png`,
      await sharp(Buffer.from(tile)).resize(size, size).png().toBuffer()
    )
  }
  return files
}
