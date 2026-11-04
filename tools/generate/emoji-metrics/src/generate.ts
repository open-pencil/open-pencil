/**
 * Writes the emoji metrics font into `packages/core/assets` from Noto Color Emoji, and the
 * keycap frame into Core's source from Noto Sans Symbols, each at a pinned google/fonts commit
 * with its licence beside it. usage: bun generate.ts
 */
import { join } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { keycapModule, keycapOutline } from './keycap'
import { EMOJI_METRICS_ASSET, emojiMetricsFont } from './metrics'
import { readFontTables, writeFontTables } from './sfnt'

const EMOJI_SOURCE =
  'https://raw.githubusercontent.com/google/fonts/142c8963e7606b510c93a644c82a4c4cdeae6ef9/ofl/notocoloremoji'
const SYMBOLS_SOURCE =
  'https://raw.githubusercontent.com/google/fonts/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosanssymbols'
const EMOJI_COPYRIGHT =
  'Copyright 2021 Google Inc. All Rights Reserved. Derived from Noto Color Emoji: metrics only.'
const SYMBOLS_COPYRIGHT =
  'Copyright 2022 The Noto Project Authors (https://github.com/notofonts/symbols)'

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

const [emoji, emojiLicence, symbols, symbolsLicence] = await Promise.all([
  download(`${EMOJI_SOURCE}/NotoColorEmoji-Regular.ttf`),
  download(`${EMOJI_SOURCE}/OFL.txt`),
  download(`${SYMBOLS_SOURCE}/NotoSansSymbols%5Bwght%5D.ttf`),
  download(`${SYMBOLS_SOURCE}/OFL.txt`)
])
const root = await resolveWorkspaceRoot(import.meta.dir)
const assets = join(root, 'packages/core/assets')
const output = writeFontTables(emojiMetricsFont(readFontTables(emoji), EMOJI_COPYRIGHT))
await Bun.write(join(assets, EMOJI_METRICS_ASSET), output)
await Bun.write(join(assets, 'OpenPencilEmojiMetrics-OFL.txt'), emojiLicence)
await Bun.write(join(assets, 'NotoSansSymbols-OFL.txt'), symbolsLicence)
const keycap = join(root, 'packages/core/src/text/font/keycap.ts')
await Bun.write(keycap, keycapModule(keycapOutline(symbols), SYMBOLS_COPYRIGHT))
// The module is source, so it takes the repository's formatting.
const formatted = Bun.spawnSync([join(root, 'node_modules/.bin/oxfmt'), '--write', keycap], {
  cwd: root
})
if (!formatted.success) throw new Error(`oxfmt: ${formatted.stderr.toString()}`)
console.log(`${EMOJI_METRICS_ASSET}: ${output.length} bytes; keycap frame written`)
