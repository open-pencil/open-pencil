/**
 * Writes the Mermaid sources `@open-pencil/mermaid` runs into `packages/mermaid/src/upstream`,
 * from the release pinned in `sources.ts`, with Mermaid's licence beside them: each grammar and
 * the parser built from it, the modules copied whole, and the declarations copied out of others.
 *
 * usage: bun generate.ts            write the pinned release's sources
 *        bun generate.ts --check    compare them, and the sources followed by hand, with
 *                                   Mermaid's latest release
 */
import { join } from 'node:path'

import { resolveWorkspaceRoot } from '@open-pencil/package-artifacts-tools'

import { checksums, CHECKSUMS_FILE } from './checksums'
import { extractDeclarations, hasImports } from './extract'
import { parserModule } from './jison'
import { latestRelease } from './releases'
import {
  COPIED_MODULES,
  EXTRACTED_MODULE,
  FOLLOWED_SOURCES,
  GRAMMARS,
  MERMAID_RELEASE,
  provenance,
  sourceURL,
  UPSTREAM_DIR
} from './sources'

async function download(path: string, commit = MERMAID_RELEASE.commit): Promise<string> {
  const url = sourceURL(path, commit)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

/**
 * What a release holds of each source, by the name it is compared under: the grammars, the
 * modules copied whole, and the declarations copied out of others.
 */
async function upstream(commit: string): Promise<Map<string, string>> {
  const texts = new Map<string, string>()
  for (const grammar of GRAMMARS) {
    texts.set(`${grammar.parser}.jison`, await download(grammar.source, commit))
  }
  for (const module of COPIED_MODULES) {
    const source = await download(module.source, commit)
    if (hasImports(source, module.source)) {
      throw new Error(`${module.source} now imports other modules; copy declarations out of it`)
    }
    texts.set(module.file, source)
  }
  const declarations: string[] = []
  for (const { source, names } of EXTRACTED_MODULE.declarations) {
    declarations.push(...extractDeclarations(await download(source, commit), source, names))
  }
  texts.set(EXTRACTED_MODULE.file, declarations.join('\n\n'))
  return texts
}

/**
 * Mermaid type-checks its own code under its own settings, which are looser than ours; copies are
 * checked there, and their declarations still give their callers types here.
 */
const COPIED_HEADER = '// @ts-nocheck\n'

const root = await resolveWorkspaceRoot(import.meta.dir)

if (process.argv.includes('--check')) {
  const latest = latestRelease()
  if (latest.tag === MERMAID_RELEASE.tag) {
    console.log(`Pinned to ${MERMAID_RELEASE.tag}, Mermaid's latest release.`)
    process.exit(0)
  }
  const scratch = join(root, 'node_modules/.cache/mermaid-sources')
  const [pinned, current] = await Promise.all([
    upstream(MERMAID_RELEASE.commit),
    upstream(latest.commit)
  ])
  for (const path of FOLLOWED_SOURCES) {
    const name = path.split('/').at(-1) ?? path
    pinned.set(name, await download(path))
    current.set(name, await download(path, latest.commit))
  }
  let changed = false
  for (const [name, text] of pinned) {
    const now = current.get(name) ?? ''
    if (text === now) continue
    changed = true
    await Bun.write(join(scratch, 'pinned', name), text)
    await Bun.write(join(scratch, 'latest', name), now)
    Bun.spawnSync(
      ['git', 'diff', '--no-index', join(scratch, 'pinned', name), join(scratch, 'latest', name)],
      { stdout: 'inherit', stderr: 'inherit' }
    )
  }
  console.log(
    changed
      ? `${latest.tag} changes the sources above: pin it in sources.ts, regenerate, and follow the changes to FlowDB and the shapes in @open-pencil/mermaid.`
      : `${latest.tag} is out, with the same sources as ${MERMAID_RELEASE.tag}.`
  )
  process.exit(changed ? 1 : 0)
}

const texts = await upstream(MERMAID_RELEASE.commit)
const files = new Map<string, string>([['MERMAID-LICENSE.txt', await download('LICENSE')]])
for (const grammar of GRAMMARS) {
  const source = texts.get(`${grammar.parser}.jison`) ?? ''
  files.set(`${grammar.parser}.jison`, source)
  files.set(`${grammar.parser}.js`, parserModule(grammar, source))
}
for (const module of COPIED_MODULES) {
  const source = texts.get(module.file) ?? ''
  files.set(module.file, `${COPIED_HEADER}${provenance([module.source], 'Copied')}\n${source}`)
}
files.set(
  EXTRACTED_MODULE.file,
  [
    COPIED_HEADER +
      provenance(
        EXTRACTED_MODULE.declarations.map(({ source }) => source),
        'Copied'
      ),
    ...EXTRACTED_MODULE.imports,
    '',
    texts.get(EXTRACTED_MODULE.file) ?? '',
    ''
  ].join('\n')
)
for (const [file, content] of files) await Bun.write(join(root, UPSTREAM_DIR, file), content)
await Bun.write(join(root, CHECKSUMS_FILE), `${JSON.stringify(checksums(files), null, 2)}\n`)
console.log(`Mermaid sources written from ${MERMAID_RELEASE.tag}`)
