import { fileURLToPath } from 'node:url'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

export const repositoryRoot = await resolveWorkspaceRoot(fileURLToPath(import.meta.url))
export const targets = ['web', 'docs', 'desktop'] as const
export type BrandTarget = (typeof targets)[number]

/**
 * Logo kit v5: the colour mark sits bare on white, black, and neutral greys, the one-colour mark
 * is ink or paper, and the ink tile holds the mark at 76% of its height, as the kit's app icon does.
 */
export const brand = {
  // The app icon and favicon tile.
  background: '#111111',
  ink: '#111111',
  paper: '#FFFFFF',
  tileInset: 64,
  tileRadius: 224,
  appScale: 0.762,
  tileScale: 0.762,
  // The desktop tile is inset, so the mark keeps the same share of the tile's height.
  desktopScale: 0.667,
  maskableScale: 0.66
} as const

export const webFiles = [
  'brand/favicon.svg',
  'brand/favicon-96x96.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'brand/app-icon.svg',
  'brand/app-icon-1024.png',
  'brand/mark.svg',
  'brand/mark-dark.svg',
  'brand/mark-micro.svg',
  'brand/mark-micro-dark.svg',
  'brand/mark-mono.svg',
  'brand/mark-mono-dark.svg'
] as const

export const pwaFiles = [
  'brand/pwa-192.png',
  'brand/pwa-512.png',
  'brand/pwa-maskable-512.png'
] as const

export const desktopFiles = [
  '32x32.png',
  '128x128.png',
  '128x128@2x.png',
  'icon.png',
  'icon.icns',
  'icon.ico',
  'Square30x30Logo.png',
  'Square44x44Logo.png',
  'Square71x71Logo.png',
  'Square89x89Logo.png',
  'Square107x107Logo.png',
  'Square142x142Logo.png',
  'Square150x150Logo.png',
  'Square284x284Logo.png',
  'Square310x310Logo.png',
  'StoreLogo.png'
] as const

export function targetDirectory(target: BrandTarget): string {
  switch (target) {
    case 'web':
      return 'public'
    case 'docs':
      return 'packages/docs/public'
    case 'desktop':
      return 'desktop/icons'
  }
}

export function targetFiles(target: BrandTarget): readonly string[] {
  if (target === 'desktop') return desktopFiles
  if (target === 'web') return [...webFiles, ...pwaFiles]
  return webFiles
}
