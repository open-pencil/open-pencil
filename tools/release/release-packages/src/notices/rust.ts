import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import * as v from 'valibot'

import type { NoticedArtifact } from './artifacts'

const TEMPLATE = join(import.meta.dir, 'rust.hbs')

const denySchema = v.object({
  licenses: v.object({ allow: v.array(v.string()) })
})

/** The licenses `cargo deny` allows the artifact's crates, which the notices accept too. */
async function allowedLicenses(root: string, artifact: NoticedArtifact): Promise<string[]> {
  const parsed = v.safeParse(
    denySchema,
    Bun.TOML.parse(await readFile(join(root, artifact.deny), 'utf8'))
  )
  if (!parsed.success) throw new Error(`${artifact.deny} has no [licenses] allow list`)
  return parsed.output.licenses.allow
}

function tomlStrings(values: readonly string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`
}

/**
 * The third-party notices of an artifact's crates, generated with cargo-about from the crates the
 * artifact's targets compile, without those only its build runs.
 */
export async function rustNotices(root: string, artifact: NoticedArtifact): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'open-pencil-notices-'))
  try {
    const config = join(directory, 'about.toml')
    await writeFile(
      config,
      [
        `accepted = ${tomlStrings(await allowedLicenses(root, artifact))}`,
        `targets = ${tomlStrings(artifact.targets)}`,
        'ignore-build-dependencies = true',
        'ignore-dev-dependencies = true'
      ].join('\n')
    )
    const child = Bun.spawn(
      [
        'cargo',
        'about',
        'generate',
        '--config',
        config,
        '--manifest-path',
        join(root, artifact.manifest),
        '--locked',
        TEMPLATE
      ],
      { cwd: dirname(join(root, artifact.manifest)), stdout: 'pipe', stderr: 'inherit' }
    )
    const [notices, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
    if (code !== 0) throw new Error(`cargo about failed for ${artifact.name} with ${code}`)
    return notices
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

/**
 * Writes every artifact's notices into the package that ships it. A release source from before
 * an artifact's package existed, such as an older tag built again, has none to write.
 */
export async function writeReleaseNotices(
  root: string,
  artifacts: readonly NoticedArtifact[]
): Promise<void> {
  for (const artifact of artifacts) {
    if (!existsSync(join(root, artifact.packageDirectory))) continue
    const output = join(root, artifact.packageDirectory, artifact.notices)
    await mkdir(dirname(output), { recursive: true })
    await writeFile(output, await rustNotices(root, artifact))
  }
}
