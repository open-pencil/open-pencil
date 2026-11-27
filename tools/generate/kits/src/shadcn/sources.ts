import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { $ } from 'bun'
import * as v from 'valibot'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

import type { KitSources } from '../kit'
import { SHADCN_CLI, SHADCN_COMPONENTS } from './components'

/** What the cached project was installed with, which must match for it to be used again. */
const stampSchema = v.object({ installer: v.string(), components: v.array(v.string()) })

const STAMP = 'stamp.json'

async function installed(cache: string): Promise<boolean> {
  const stamp = Bun.file(join(cache, STAMP))
  if (!(await stamp.exists())) return false
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), stampSchema), await stamp.text())
  return (
    parsed.success &&
    parsed.output.installer === SHADCN_CLI &&
    parsed.output.components.join(',') === SHADCN_COMPONENTS.join(',')
  )
}

/**
 * Sets up a project as a shadcn/ui user does, with its CLI: Radix primitives, the nova style,
 * the neutral theme, and lucide icons, then the kit's components from the registry as it is.
 */
async function install(cache: string): Promise<void> {
  await mkdir(dirname(cache), { recursive: true })
  const parent = await mkdtemp(`${cache}.`)
  try {
    await $`bunx ${SHADCN_CLI} init -t vite -b radix -p nova --no-monorepo -n app -y`
      .cwd(parent)
      .quiet()
    const app = join(parent, 'app')
    await $`bunx ${SHADCN_CLI} add ${SHADCN_COMPONENTS} -y --overwrite`.cwd(app).quiet()
    await Bun.write(
      join(app, STAMP),
      JSON.stringify({ installer: SHADCN_CLI, components: SHADCN_COMPONENTS })
    )
    await rm(cache, { recursive: true, force: true })
    await rename(app, cache)
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
}

/**
 * shadcn/ui's sources, installed into `.cache/kits/shadcn` the first time and whenever the CLI or
 * the components change.
 */
export async function shadcnSources(): Promise<KitSources> {
  const root = await resolveWorkspaceRoot(fileURLToPath(import.meta.url))
  const cache = join(root, '.cache/kits/shadcn')
  if (!(await installed(cache))) await install(cache)
  const src = join(cache, 'src')
  return {
    root: cache,
    stylesheet: join(src, 'index.css'),
    modules: Object.fromEntries(
      SHADCN_COMPONENTS.map((name) => [name, join(src, 'components/ui', `${name}.tsx`)])
    ),
    aliases: { '@': src },
    installer: SHADCN_CLI
  }
}
