import { mkdir, mkdtemp, rename, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as v from 'valibot'
import { parse as parseYAML } from 'yaml'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools/workspace'

import type { KitDoc, KitSources } from '../kit'
import { SHADCN_CLI, SHADCN_COMPONENTS, SHADCN_DOCS } from './components'

/** What the cached project was installed with, which must match for it to be used again. */
const stampSchema = v.object({ installer: v.string(), components: v.array(v.string()) })

/** The front matter of a component's documentation page. */
const frontMatterSchema = v.object({
  title: v.string(),
  description: v.string(),
  links: v.optional(v.record(v.string(), v.string()), {})
})

const docsSchema = v.record(v.string(), frontMatterSchema)

const STAMP = 'stamp.json'
const DOCS = 'docs.json'

/** The module of a component's examples, as the registry names it. */
export const exampleModule = (name: string) => `${name}-example`

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

/** A component's documentation page's front matter, as the docs site serves it in Markdown. */
async function fetchDoc(name: string): Promise<KitDoc> {
  const response = await fetch(`${SHADCN_DOCS}/${name}.md`)
  if (!response.ok) throw new Error(`No documentation for ${name}: ${response.status}`)
  const matter = /^---\n([\s\S]*?)\n---/.exec(await response.text())?.[1]
  const parsed = v.safeParse(frontMatterSchema, matter ? parseYAML(matter) : undefined)
  if (!parsed.success) throw new Error(`The documentation of ${name} has no title or description`)
  return parsed.output
}

/** Runs the pinned shadcn CLI in `cwd`, answering yes to what it asks. */
async function shadcn(cwd: string, args: string[]): Promise<void> {
  const name = args[0] === 'init' ? ['-n', 'app'] : []
  const child = Bun.spawn(['bunx', SHADCN_CLI, ...args, ...name, '-y'], {
    cwd,
    stdout: 'ignore',
    stderr: 'pipe'
  })
  if ((await child.exited) !== 0)
    throw new Error(`shadcn ${args[0]} failed: ${await new Response(child.stderr).text()}`)
}

/**
 * Sets up a project as a shadcn/ui user does, with its CLI: Radix primitives, the nova style,
 * the neutral theme, and lucide icons, then the kit's components and their examples from the
 * registry as it is, and their documentation's titles and descriptions.
 */
async function install(cache: string): Promise<void> {
  await mkdir(dirname(cache), { recursive: true })
  const parent = await mkdtemp(`${cache}.`)
  try {
    await shadcn(parent, ['init', '-t', 'vite', '-b', 'radix', '-p', 'nova', '--no-monorepo'])
    const app = join(parent, 'app')
    const items = [...SHADCN_COMPONENTS, ...SHADCN_COMPONENTS.map(exampleModule)]
    await shadcn(app, ['add', ...items, '--overwrite'])
    const docs = Object.fromEntries(
      await Promise.all(SHADCN_COMPONENTS.map(async (name) => [name, await fetchDoc(name)]))
    )
    await Bun.write(join(app, DOCS), JSON.stringify(docs, null, 2))
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
  const docs = v.parse(
    v.pipe(v.string(), v.parseJson(), docsSchema),
    await Bun.file(join(cache, DOCS)).text()
  )
  return {
    root: cache,
    stylesheet: join(src, 'index.css'),
    modules: Object.fromEntries(
      SHADCN_COMPONENTS.flatMap((name) => [
        [name, join(src, 'components/ui', `${name}.tsx`)],
        [exampleModule(name), join(src, 'components', `${exampleModule(name)}.tsx`)]
      ])
    ),
    aliases: { '@': src },
    installer: SHADCN_CLI,
    docs
  }
}
