import dedent from 'dedent'

import type { HandoffSpec } from './spec'

export interface HandoffFrameFile {
  name: string
  slug: string
  width: number
  height: number
}

function fontLines(spec: HandoffSpec): string {
  if (spec.fonts.length === 0) return '- (no text)'
  return spec.fonts
    .map((f) => `- ${f.family}${f.italic ? ' italic' : ''}: weights ${f.weights.join(', ')}`)
    .join('\n')
}

function frameLines(frames: HandoffFrameFile[]): string {
  return frames
    .map(
      (f) =>
        `| ${f.name} | ${f.width} × ${f.height} | \`reference/${f.slug}@1x.png\`, \`reference/${f.slug}@2x.png\` | \`#${f.slug}\` |`
    )
    .join('\n')
}

/**
 * The package's entry point for a coding agent (Claude Code reads `CLAUDE.md` first): what is in
 * the package, the rules that make the build match, and how to prove it matches.
 */
export function handoffGuide(spec: HandoffSpec, frames: HandoffFrameFile[]): string {
  return dedent`
    # Design handoff — build this exactly

    This package was exported from Lawha. Implement the design so that it renders **pixel-identical**
    to the reference images, in whatever stack the project uses (HTML/CSS, React, Vue, Svelte,
    SwiftUI, Flutter, Jetpack Compose…). Do not redesign, round values, or substitute fonts or
    colours. When the spec and the reference disagree, the reference image wins and you report it.

    ## Contents

    | Path | What it is |
    | --- | --- |
    | \`spec/design.json\` | Every layer: exact position, size, auto layout, colours, strokes, effects, text, images, components, interactions. The source of truth for values. |
    | \`reference/\` | What it must look like: each frame at 1x and 2x (PNG). |
    | \`code/index.html\` | A working HTML/CSS implementation, with \`code/index.assets/\` (styles, images, fonts). Use it as the reference implementation or port it. |
    | \`code/tailwind.jsx\` | The same layers as React + Tailwind classes. |
    | \`tokens/\` | Design tokens (W3C DTCG JSON) and \`tokens/tokens.css\` custom properties. |
    | \`assets/images/\` | Every image at full resolution, named by content hash. |
    | \`verify/verify.mjs\` | Screenshots your build and diffs it against \`reference/\`, pixel by pixel. |

    ## Frames

    | Frame | Size (px) | Reference | Element id to give the built frame |
    | --- | --- | --- | --- |
    ${frameLines(frames)}

    ## Fonts (load exactly these)

    ${fontLines(spec)}

    The font files are in \`code/index.assets/\` when they could be bundled; otherwise
    \`code/fonts.html\` holds the Google Fonts \`<link>\` for exactly these families and weights,
    and \`code/index.html\` already loads it. Load the listed weights only, with
    \`font-display: block\` while verifying so screenshots never catch a fallback font.

    ## Rules that make it match

    1. **Units.** All numbers are CSS pixels at 1x. Keep fractions (e.g. 13.5px). Device pixel ratio
       does not change layout.
    2. **Auto layout → flexbox.** \`layout.mode\` HORIZONTAL is \`flex-direction: row\`, VERTICAL is
       \`column\`; \`gap\` is \`gap\`, \`crossGap\` is \`row-gap\` when \`wrap\` is true, \`padding\` is padding.
       \`justify\`: MIN start, CENTER center, MAX end, SPACE_BETWEEN space-between. \`align\`: MIN start,
       CENTER center, MAX end, BASELINE baseline. Sizing FIXED is a fixed size, HUG is
       \`fit-content\`, FILL is \`flex: 1\` / \`align-self: stretch\`. A child with
       \`child.positioning: ABSOLUTE\` is \`position: absolute\` at its \`local\` x/y.
    3. **No auto layout → absolute.** Children of a layer without \`layout\` are positioned absolutely
       at \`local.x\`/\`local.y\` inside it; \`constraints\` say how they react to resizing
       (MIN left/top, MAX right/bottom, STRETCH both, CENTER centred, SCALE proportional).
    4. **Box model.** Use \`box-sizing: border-box\`. Stroke \`align\` INSIDE draws within the box
       (\`box-shadow: inset 0 0 0 Wpx\` or an inner border), CENTER straddles the edge, OUTSIDE draws
       outside (\`outline\`). Strokes never change layout size.
    5. **Corners.** \`cornerRadius\` is one value or [top-left, top-right, bottom-right, bottom-left].
       \`clipsContent: true\` is \`overflow: hidden\`.
    6. **Colour.** Hex as given, in sRGB. A layer's \`opacity\` applies to the whole layer (CSS
       \`opacity\`), separate from a paint's alpha. Several fills stack bottom to top: the last fill
       is on top.
    7. **Effects.** DROP_SHADOW → \`box-shadow: x y radius spread color\` (text: \`text-shadow\`),
       INNER_SHADOW → \`inset\` box-shadow, LAYER_BLUR → \`filter: blur(radius/2)\`, BACKGROUND_BLUR →
       \`backdrop-filter: blur(radius/2)\`.
    8. **Text.** Exact \`fontFamily\`, \`fontWeight\`, \`fontSize\`; \`lineHeight\` in PIXELS is
       \`line-height: Npx\`, PERCENT is a percentage of font size, AUTO is \`normal\`;
       \`letterSpacing\` PERCENT is \`em\` / 100. \`direction\` RTL is \`dir="rtl"\` (Arabic text must
       use \`dir="rtl"\` and the given \`language\` as \`lang\`). \`autoResize\` WIDTH_AND_HEIGHT is
       \`white-space: nowrap\`; HEIGHT wraps within the width; NONE is a fixed box. \`runs\` style
       character ranges (start, length) differently from the layer.
    9. **Images.** \`scaleMode\` FILL is \`object-fit: cover\`, FIT \`contain\`, TILE a repeated
       background, CROP uses the paint transform. Images in \`assets/images/\` are the
       originals: when a paint has \`adjustments\` (exposure, levels, curve…), the reference image
       shows the adjusted result, so apply them (CSS filters cover brightness, contrast, saturate,
       hue-rotate, invert) or export that image adjusted from Lawha and use it instead.
    10. **Vectors.** Use the SVG paths in \`code/index.html\` for vector layers and icons; do not
        redraw them.
    11. **Components.** Layers with the same \`component.componentId\` are one reusable component;
        build it once and reuse it.
    12. **Interactions.** \`interactions\` (prototype): \`trigger\` (click, hover, press, drag, after
        delay…) → \`action\` (navigate to a frame id, overlay, back, scroll, open URL) with its
        \`transition\` (dissolve, slide, push, move in/out, smart animate, duration, easing). Wire
        them as routes and animations.

    ## Verify — you are done only when this passes

    \`\`\`bash
    npm i -D playwright && npx playwright install chromium
    node verify/verify.mjs http://localhost:5173/your-page
    \`\`\`

    The script opens your page, screenshots each element with the frame's id (table above) at its
    exact size, and compares it with \`reference/<frame>@1x.png\`. It prints the share of differing
    pixels per frame and writes \`verify/diff-<frame>.png\` with differences in red. The goal is
    **0.1% or less** per frame; edge anti-aliasing is already forgiven, so anything above that is a
    real difference. Above that, open
    the diff, fix the cause (usually a font, line height, padding, or radius), and run it again.
    Pass \`--threshold 0\` to demand no differing pixel at all.
  `
}

/** A dependency-free verifier: Playwright for the screenshot, the browser's canvas for the diff. */
export function handoffVerifier(frames: HandoffFrameFile[]): string {
  return dedent`
    // Pixel check for this handoff package. Usage: node verify/verify.mjs <url> [--threshold 0.1]
    import { readFileSync, writeFileSync } from 'node:fs'
    import { dirname, join } from 'node:path'
    import { fileURLToPath } from 'node:url'
    import { chromium } from 'playwright'

    const FRAMES = ${JSON.stringify(frames, null, 2)}
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const url = process.argv[2]
    const at = process.argv.indexOf('--threshold')
    const threshold = at > 0 ? Number(process.argv[at + 1]) : 0.1
    if (!url) {
      console.error('Usage: node verify/verify.mjs <url> [--threshold 0.1]')
      process.exit(2)
    }

    const browser = await chromium.launch()
    const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: 1920, height: 1080 } })
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    let failed = 0
    for (const frame of FRAMES) {
      const el = page.locator('#' + frame.slug)
      if ((await el.count()) === 0) {
        console.log('✗ ' + frame.name + ': no element with id "' + frame.slug + '"')
        failed++
        continue
      }
      const actual = await el.first().screenshot()
      const expected = readFileSync(join(root, 'reference', frame.slug + '@1x.png'))
      const result = await page.evaluate(
        async ({ a, b, w, h }) => {
          const load = async (b64) => createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob())
          const [ia, ib] = await Promise.all([load(a), load(b)])
          const read = (img) => {
            const c = new OffscreenCanvas(w, h)
            const x = c.getContext('2d')
            // Both on white: the reference is transparent where the frame draws nothing (outside
            // rounded corners), while a screenshot shows the page behind.
            x.fillStyle = '#fff'
            x.fillRect(0, 0, w, h)
            x.drawImage(img, 0, 0)
            return x.getImageData(0, 0, w, h)
          }
          const da = read(ia).data
          const db = read(ib).data
          const out = new OffscreenCanvas(w, h)
          const ox = out.getContext('2d')
          const diff = ox.createImageData(w, h)
          const far = (p, q) => Math.max(Math.abs(da[p] - db[q]), Math.abs(da[p + 1] - db[q + 1]), Math.abs(da[p + 2] - db[q + 2]), Math.abs(da[p + 3] - db[q + 3])) > 4
          // Anti-aliasing differs between renderers. An edge pixel is a blend of the colours on
          // either side, so a pixel whose every channel lies within the range of the reference's
          // 3×3 neighbourhood is an edge blend, not a mistake. A wrong colour in a flat area or a
          // moved element falls outside that range and counts.
          const wrong = (i) => {
            if (!far(i, i)) return false
            const px = (i / 4) % w
            const py = Math.floor(i / 4 / w)
            for (let c = 0; c < 4; c++) {
              let lo = 255
              let hi = 0
              for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                  const nx = px + ox
                  const ny = py + oy
                  if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
                  const v = db[(ny * w + nx) * 4 + c]
                  if (v < lo) lo = v
                  if (v > hi) hi = v
                }
              }
              const v = da[i + c]
              if (v < lo - 4 || v > hi + 4) return true
            }
            return false
          }
          let bad = 0
          for (let i = 0; i < da.length; i += 4) {
            const off = wrong(i)
            if (off) bad++
            diff.data.set(off ? [255, 0, 0, 255] : [db[i], db[i + 1], db[i + 2], 60], i)
          }
          ox.putImageData(diff, 0, 0)
          const blob = await out.convertToBlob({ type: 'image/png' })
          const bytes = new Uint8Array(await blob.arrayBuffer())
          let s = ''
          for (const byte of bytes) s += String.fromCharCode(byte)
          return { percent: (bad / (w * h)) * 100, size: [ia.width, ia.height], diff: btoa(s) }
        },
        { a: actual.toString('base64'), b: expected.toString('base64'), w: frame.width, h: frame.height }
      )
      writeFileSync(join(root, 'verify', 'diff-' + frame.slug + '.png'), Buffer.from(result.diff, 'base64'))
      const sizeOk = Math.abs(result.size[0] - frame.width) <= 1 && Math.abs(result.size[1] - frame.height) <= 1
      const ok = sizeOk && result.percent <= threshold
      if (!ok) failed++
      console.log(
        (ok ? '✓ ' : '✗ ') + frame.name + ': ' + result.percent.toFixed(2) + '% different' +
          (sizeOk ? '' : ' — built size ' + result.size.join('×') + ', expected ' + frame.width + '×' + frame.height)
      )
    }
    await browser.close()
    process.exit(failed ? 1 : 0)
  `
}
