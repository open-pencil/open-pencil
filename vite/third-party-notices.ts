import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import license, { type Dependency } from 'rollup-plugin-license'
import satisfies from 'spdx-satisfies'
import * as v from 'valibot'
import type { Plugin } from 'vite'

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

const manifestSchema = v.object({
  name: v.optional(v.string()),
  workspaces: v.optional(v.array(v.string()))
})

function readManifest(directory: string) {
  const text = readFileSync(join(directory, 'package.json'), 'utf8')
  return v.parse(v.pipe(v.string(), v.parseJson(), manifestSchema), text)
}

/** The names of the workspace's own packages, which are OpenPencil's, not third parties'. */
function workspacePackages(root: string): Set<string> {
  const directories = readManifest(root).workspaces ?? []
  return new Set(directories.flatMap((directory) => readManifest(join(root, directory)).name ?? []))
}

function fenced(text: string): string {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map(([run]) => run.length))
  const fence = '`'.repeat(longest + 1)
  return `${fence}text\n${text.trimEnd()}\n${fence}`
}

function section(dependency: Dependency): string {
  const { name, version, license: spdx, licenseText, noticeText } = dependency
  const texts = [licenseText, noticeText].filter((text): text is string => Boolean(text))
  return [
    `## ${name} ${version}`,
    `[npm](https://www.npmjs.com/package/${name}/v/${version}) · ${spdx ?? 'no license field'}`,
    ...(texts.length > 0 ? texts.map(fenced) : ['The package carries no license file.'])
  ].join('\n\n')
}

/**
 * Writes `THIRD-PARTY-NOTICES.md` into `outDir` with the license of every npm package the build
 * bundles, which the licenses ask a redistributed bundle to carry, and fails the build on a
 * license outside `ALLOWED_LICENSES`. The workspace's own packages are left out.
 */
export function thirdPartyNoticesPlugin(root: string, outDir: string): Plugin {
  const own = workspacePackages(root)
  return license({
    thirdParty: {
      includePrivate: false,
      // Each version bundled, since versions of one package may differ in license or notices.
      multipleVersions: true,
      allow: { test: licenseAllowed, failOnViolation: true, failOnUnlicensed: false },
      output: {
        file: resolve(outDir, 'THIRD-PARTY-NOTICES.md'),
        template: (dependencies) =>
          [
            '# Third-party notices',
            'This app bundles the npm packages below, each at the version listed and under the license it is listed with.',
            ...dependencies
              .filter((dependency) => !own.has(dependency.name ?? ''))
              .toSorted((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`))
              .map(section)
          ].join('\n\n')
      }
    }
  }) as Plugin
}
