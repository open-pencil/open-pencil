import { appendFileSync, existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import license, { type Dependency } from 'rollup-plugin-license'
import satisfies from 'spdx-satisfies'
import * as v from 'valibot'
import type { Plugin, PluginOption } from 'vite'

/**
 * The licenses a bundled npm package may carry. EPL-2.0 and MPL-2.0 are file-level copyleft, met
 * by notices that name each package's source.
 */
const ALLOWED_LICENSES = [
  '0BSD',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'EPL-2.0',
  'ISC',
  'MIT',
  'MPL-2.0',
  'Zlib'
]

/** The license taken where a package's own field is not an expression SPDX can read. */
const LICENSE_CHOICES: Partial<Record<string, string>> = {
  // `MIT OR SEE LICENSE IN FEEL-FREE.md`
  rgbcolor: 'MIT'
}

/** Whether a package's license, or the one chosen for it, is allowed. */
export function licenseAllowed({ name, license: spdx }: Pick<Dependency, 'name' | 'license'>) {
  const expression = (name && LICENSE_CHOICES[name]) ?? spdx
  try {
    return expression !== null && satisfies(expression, ALLOWED_LICENSES)
  } catch {
    return false
  }
}

const NOTICES = 'THIRD-PARTY-NOTICES.md'

const manifestSchema = v.object({
  name: v.optional(v.string()),
  version: v.optional(v.string()),
  license: v.optional(v.string()),
  dependencies: v.optional(v.record(v.string(), v.string())),
  workspaces: v.optional(v.array(v.string()))
})

function readManifest(directory: string) {
  const text = readFileSync(join(directory, 'package.json'), 'utf8')
  return v.parse(v.pipe(v.string(), v.parseJson(), manifestSchema), text)
}

/** The workspace's own packages by name, with their directories. */
function workspacePackages(root: string): Map<string, string> {
  const directories = readManifest(root).workspaces ?? []
  return new Map(
    directories.flatMap((directory) => {
      const { name } = readManifest(join(root, directory))
      return name ? [[name, join(root, directory)] as const] : []
    })
  )
}

/**
 * The notices of a workspace package built from one of OpenPencil's forks, such as CanvasKit or
 * Taffy: the fork's release, which the package pins in `release.json`, carries the licenses of
 * what it compiled in. Null for the workspace's own code.
 */
function forkNotices(directory: string): string | null {
  if (!existsSync(join(directory, 'release.json'))) return null
  const notices = join(directory, 'dist', NOTICES)
  if (!existsSync(notices)) throw new Error(`${notices} is missing; run bun install`)
  return readFileSync(notices, 'utf8')
}

function fenced(text: string): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map(([run]) => run.length))
  const fence = '`'.repeat(longest + 1)
  return `${fence}text\n${text.trimEnd()}\n${fence}`
}

type NoticeEntry = Pick<Dependency, 'name' | 'version' | 'license' | 'licenseText' | 'noticeText'>

function section(dependency: NoticeEntry): string {
  const { name, version, license: spdx, licenseText, noticeText } = dependency
  const texts = [licenseText, noticeText].filter((text): text is string => Boolean(text))
  return [
    `## ${name} ${version}`,
    `[npm](https://www.npmjs.com/package/${name}/v/${version}) · ${spdx ?? 'no license field'}`,
    ...(texts.length > 0 ? texts.map(fenced) : ['The package carries no license file.'])
  ].join('\n\n')
}

/** The directory a package resolves to from `from`, by Node's lookup through `node_modules`. */
function packageDirectory(name: string, from: string): string {
  for (let directory = from; ; directory = dirname(directory)) {
    const candidate = join(directory, 'node_modules', name)
    // Its real path, from which its own dependencies resolve, as a symlinked install links them.
    if (existsSync(join(candidate, 'package.json'))) return realpathSync(candidate)
    if (dirname(directory) === directory) throw new Error(`Cannot find ${name} from ${from}`)
  }
}

/**
 * The Workbox packages the service worker ships, by the `workbox:<package>:<version>` mark each
 * one's code sets, which no module graph of the page's build shows: vite-plugin-pwa writes the
 * worker afterwards with workbox-build.
 */
function serviceWorkerPackages(outDir: string): NoticeEntry[] {
  const scripts = readdirSync(outDir).filter((file) => /^(sw|workbox-[\w-]+)\.js$/.test(file))
  const names = new Set(
    scripts.flatMap((file) =>
      [...readFileSync(join(outDir, file), 'utf8').matchAll(/workbox:([a-z-]+):\d/g)].map(
        ([, name]) => `workbox-${name}`
      )
    )
  )
  // The packages as installed for workbox-build, which bundles them; Workbox's marks carry a
  // version string that can lag the package's own.
  const pwa = packageDirectory('vite-plugin-pwa', dirname(fileURLToPath(import.meta.url)))
  const build = packageDirectory('workbox-build', pwa)
  // Each marked package and what it brings along outside Workbox, such as idb under
  // workbox-expiration; the marked packages' Workbox dependencies are marked themselves.
  const directories = new Map<string, string>()
  const add = (name: string, from: string) => {
    const directory = packageDirectory(name, from)
    if (directories.has(directory)) return
    directories.set(directory, name)
    for (const dependency of Object.keys(readManifest(directory).dependencies ?? {})) {
      if (!dependency.startsWith('workbox-')) add(dependency, directory)
    }
  }
  for (const name of names) add(name, build)
  return [...directories]
    .map(([directory, name]) => {
      const manifest = readManifest(directory)
      const text = (pattern: RegExp) => {
        const file = readdirSync(directory).find((entry) => pattern.test(entry))
        return file ? readFileSync(join(directory, file), 'utf8') : null
      }
      return {
        name,
        version: manifest.version ?? null,
        license: manifest.license ?? null,
        licenseText: text(/^licen[cs]e/i),
        noticeText: text(/^notice/i)
      }
    })
    .toSorted((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
}

/**
 * Writes `THIRD-PARTY-NOTICES.md` into `outDir` with the license of every npm package the build
 * bundles, the service worker's Workbox packages included, which the licenses ask a redistributed
 * bundle to carry, and fails the build on a
 * license outside `ALLOWED_LICENSES`. The workspace's own packages are left out, apart from the
 * builds of OpenPencil's forks, which carry their forks' notices.
 */
export function thirdPartyNoticesPlugin(root: string, outDir: string): PluginOption[] {
  const own = workspacePackages(root)
  const serviceWorker: Plugin = {
    name: 'open-pencil-service-worker-notices',
    apply: 'build',
    closeBundle: {
      order: 'post',
      sequential: true,
      handler() {
        const notices = resolve(outDir, NOTICES)
        if (!existsSync(notices)) return
        const packages = serviceWorkerPackages(outDir)
        const disallowed = packages.filter((entry) => !licenseAllowed(entry))
        if (disallowed.length > 0) {
          throw new Error(`Service worker licenses not allowed: ${disallowed.map((e) => e.name)}`)
        }
        appendFileSync(notices, packages.map((entry) => `\n\n${section(entry)}`).join(''))
      }
    }
  }
  const page = license({
    thirdParty: {
      includePrivate: false,
      // Each version bundled, since versions of one package may differ in license or notices.
      multipleVersions: true,
      allow: { test: licenseAllowed, failOnViolation: true, failOnUnlicensed: false },
      output: {
        file: resolve(outDir, NOTICES),
        template: (dependencies) =>
          [
            '# Third-party notices',
            'This app bundles the npm packages below, each at the version listed and under the license it is listed with.',
            ...dependencies
              .flatMap((dependency) => {
                const directory = own.get(dependency.name ?? '')
                if (directory === undefined) return [dependency]
                // A fork's build is third-party code, under its own license and its notices.
                const noticeText = forkNotices(directory)
                return noticeText === null ? [] : [{ ...dependency, noticeText }]
              })
              .toSorted((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
              .map(section)
          ].join('\n\n')
      }
    }
  }) as Plugin
  return [page, serviceWorker]
}
