import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import * as v from 'valibot'

/** An npm package a build bundles, with what its license asks the bundle to carry. */
export interface BundledPackage {
  name: string
  version: string
  license: string
  /** The package's license and notice files, which redistribution carries with it. */
  texts: string[]
}

const manifestSchema = v.object({
  name: v.string(),
  version: v.string(),
  license: v.optional(v.union([v.string(), v.object({ type: v.string() })]))
})

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.|-|$)/i

/**
 * The directory of the npm package a bundled module comes from, the folder its name names after
 * the last `node_modules`, or null for the workspace's own modules and virtual ones.
 */
export function packageDirectoryOf(moduleId: string): string | null {
  const path = moduleId.split('?')[0]?.replaceAll('\\', '/') ?? ''
  if (path.startsWith('\0')) return null
  const at = path.lastIndexOf('/node_modules/')
  if (at === -1) return null
  const parts = path.slice(at + '/node_modules/'.length).split('/')
  const length = parts[0]?.startsWith('@') ? 2 : 1
  if (parts.length <= length) return null
  return `${path.slice(0, at)}/node_modules/${parts.slice(0, length).join('/')}`
}

async function bundledPackage(directory: string): Promise<BundledPackage> {
  const text = await readFile(join(directory, 'package.json'), 'utf8')
  const manifest = v.parse(manifestSchema, v.parse(v.pipe(v.string(), v.parseJson()), text))
  const files = (await readdir(directory)).filter((file) => LICENSE_FILE.test(file)).toSorted()
  const license = manifest.license
  return {
    name: manifest.name,
    version: manifest.version,
    license: (typeof license === 'string' ? license : license?.type) ?? 'UNKNOWN',
    texts: await Promise.all(files.map((file) => readFile(join(directory, file), 'utf8')))
  }
}

/** The npm packages the modules of a bundle come from, by name and version. */
export async function bundledPackages(moduleIds: Iterable<string>): Promise<BundledPackage[]> {
  const directories = new Set<string>()
  for (const id of moduleIds) {
    const directory = packageDirectoryOf(id)
    if (directory) directories.add(directory)
  }
  const packages = await Promise.all([...directories].map(bundledPackage))
  const unique = new Map(packages.map((pkg) => [`${pkg.name}@${pkg.version}`, pkg]))
  return [...unique.values()].toSorted(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
  )
}

function fenced(text: string): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map(([run]) => run.length))
  const fence = '`'.repeat(longest + 1)
  return `${fence}text\n${text.trimEnd()}\n${fence}`
}

/** The third-party notices of the npm packages a bundle carries, as Markdown. */
export function javascriptNotices(packages: readonly BundledPackage[]): string {
  const sections = packages.map((pkg) =>
    [
      `## ${pkg.name} ${pkg.version}`,
      `[npm](https://www.npmjs.com/package/${pkg.name}/v/${pkg.version}) · ${pkg.license}`,
      ...(pkg.texts.length > 0 ? pkg.texts.map(fenced) : ['The package carries no license file.'])
    ].join('\n\n')
  )
  return [
    '# Third-party notices',
    'This app bundles the npm packages below, each at the version listed and under the license it is listed with.',
    ...sections
  ].join('\n\n')
}
