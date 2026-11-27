import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'

/**
 * What a stage's pixels depend on: the landing and the docs theme around it, the app
 * components it mounts, every package they reach, the engine builds that draw and lay them out,
 * the demo document, and this generator. CI reuses the stills of a fingerprint across deploys, so
 * an input left out here deploys stills of the old one.
 * Imported by the VitePress config, so it uses Node built-ins only.
 */
export const LANDING_POSTER_INPUTS = {
  directories: [
    'packages/docs/.vitepress/theme',
    'src',
    'packages/core/src',
    // The fonts Core bundles, which its source imports by path only.
    'packages/core/assets',
    'packages/scene-graph/src',
    'packages/vue/src',
    'packages/design-jsx/src',
    'packages/dom-css/src',
    'packages/emit/src',
    'packages/fig/src',
    'packages/kiwi/src',
    'packages/theme/src',
    'packages/std/src',
    'packages/collab/src',
    'packages/pen/src',
    'packages/drawio/src',
    'packages/mermaid/src',
    'packages/html-engine/src',
    'packages/html-engine/crate/src',
    'packages/cloud/src',
    'tools/generate/demo/src',
    'tools/generate/landing-posters/src'
  ],
  files: [
    'package.json',
    'bun.lock',
    'packages/docs/.vitepress/config.ts',
    // The CanvasKit and Taffy builds the stages draw and lay out with, pinned by release.
    'packages/canvaskit/release.json',
    'packages/taffy/release.json',
    'packages/html-engine/crate/Cargo.toml',
    // Its locale prefixes are the pages the stills are captured on.
    'packages/docs/.vitepress/seo.ts'
  ]
}

/** Short enough for a URL segment, long enough that two builds never collide. */
const FINGERPRINT_LENGTH = 16

async function filesUnder(root: string, directory: string): Promise<string[]> {
  const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
}

/** Changes whenever an input changes, so changed stages get new poster URLs. */
export async function landingPosterFingerprint(
  root: string,
  inputs = LANDING_POSTER_INPUTS
): Promise<string> {
  const listed = await Promise.all(inputs.directories.map((dir) => filesUnder(root, dir)))
  const paths = [...listed.flat(), ...inputs.files].sort()
  const hash = createHash('sha256')
  for (const path of paths) {
    hash
      .update(path)
      .update('\0')
      .update(await readFile(join(root, path)))
      .update('\0')
  }
  return hash.digest('hex').slice(0, FINGERPRINT_LENGTH)
}
