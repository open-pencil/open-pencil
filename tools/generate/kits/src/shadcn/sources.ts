#!/usr/bin/env bun
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Copies shadcn/ui's components into `upstream/shadcn` as its CLI installs them into a new
 * project: Radix primitives, the nova style, the neutral theme, and lucide icons. Run it with
 * `--from <project>` to copy from a project the CLI already set up.
 */
import { $ } from 'bun'

import { SHADCN_COMPONENTS, SHADCN_UPSTREAM } from './components'

const CLI = 'shadcn@4.23.1'
const SETUP = 'Radix primitives, the nova style, the neutral theme, and lucide icons'

function header(source: string): string {
  return [
    `Copied by \`bun run sources:shadcn\` from a project ${CLI} set up with ${SETUP}`,
    `(${source}). Copyright (c) 2023 shadcn. MIT License; see LICENSE.md.`,
    'Do not edit: change the pinned CLI or the components in tools/generate/kits and regenerate.'
  ].join('\n')
}

async function project(): Promise<string> {
  const from = process.argv.indexOf('--from')
  if (from !== -1) {
    const path = process.argv.at(from + 1)
    if (!path) throw new Error('--from needs the project folder')
    return path
  }
  const parent = await mkdtemp(join(tmpdir(), 'shadcn-'))
  await $`bunx ${CLI} init -t vite -b radix -p nova --no-monorepo -n app -y`.cwd(parent)
  const app = join(parent, 'app')
  await $`bunx ${CLI} add ${SHADCN_COMPONENTS} -y --overwrite`.cwd(app)
  return app
}

/** The components `names` use from each other, which the CLI installed beside them. */
async function withImports(app: string, names: readonly string[]): Promise<string[]> {
  const found = new Set(names)
  for (const name of found) {
    const source = await Bun.file(join(app, 'src/components/ui', `${name}.tsx`)).text()
    for (const [, used] of source.matchAll(/from "@\/components\/ui\/([\w-]+)"/g)) found.add(used)
  }
  return [...found].sort()
}

const app = await project()
const ui = await withImports(app, SHADCN_COMPONENTS)
for (const name of ui) {
  const path = `src/components/ui/${name}.tsx`
  const source = await Bun.file(join(app, path)).text()
  // The components import each other through the project's `@/` alias, which here is a folder.
  const local = source.replaceAll(/from "@\/components\/ui\/([\w-]+)"/g, 'from "./$1"')
  const comment = header(path)
    .split('\n')
    .map((line) => `// ${line}`)
    .join('\n')
  await Bun.write(
    join(SHADCN_UPSTREAM, 'ui', `${name}.tsx`),
    `// @ts-nocheck\n${comment}\n${local}`
  )
}
const stylesheets = {
  'index.css': join(app, 'src/index.css'),
  'tailwind.css': join(app, 'node_modules/shadcn/dist/tailwind.css')
}
for (const [name, path] of Object.entries(stylesheets)) {
  // The theme imports shadcn's own stylesheet from its CLI package, copied here beside it.
  const source = (await Bun.file(path).text()).replace(
    '@import "shadcn/tailwind.css";',
    '@import "./tailwind.css";'
  )
  const where = path.slice(app.length + 1)
  await Bun.write(join(SHADCN_UPSTREAM, name), `/*\n${header(where)}\n*/\n${source}`)
}
await Bun.write(
  join(SHADCN_UPSTREAM, 'LICENSE.md'),
  await Bun.file(join(app, 'node_modules/shadcn/LICENSE.md')).text()
)
console.log(`Copied ${ui.length} components to ${SHADCN_UPSTREAM}`)
