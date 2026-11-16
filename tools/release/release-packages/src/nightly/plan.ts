import { NIGHTLY_TAG, nightlyVersion } from '#release/version'
import * as v from 'valibot'

import { CommandError } from '@open-pencil/package-artifacts-tools'

import { commitSchema } from '../native/context.ts'

export interface NightlyPlan {
  /** Master's commit, which tonight's nightly builds. */
  source: string
  version: string
  /** Master has not moved since the last nightly, so there is nothing new to build. */
  skip: boolean
}

export interface NightlySources {
  /** Master as the plan's checkout fetched it. */
  master: () => Promise<string>
  /** The commit the nightly tag points at, or nothing before the first nightly. */
  lastNightly: () => Promise<string | undefined>
  /** The version the nightly release names, or nothing before the first one. */
  lastVersion: () => Promise<string | undefined>
  /** Master's version, from its root `package.json`. */
  masterVersion: (commit: string) => Promise<string>
}

/** Tonight's nightly: master's commit, its version, and whether it is the last one again. */
export async function planNightly(sources: NightlySources, now: Date): Promise<NightlyPlan> {
  const source = v.parse(commitSchema, await sources.master())
  const skip = (await sources.lastNightly()) === source
  const version = nightlyVersion(
    await sources.masterVersion(source),
    now,
    await sources.lastVersion()
  )
  return { source, version, skip }
}

const manifestSchema = v.pipe(v.string(), v.parseJson(), v.object({ version: v.string() }))

/** The plan's sources in a checkout with master's history and tags, as the plan job's is. */
export function checkoutSources(
  git: (...args: string[]) => Promise<string>,
  github: (args: string[]) => Promise<string>,
  repository: string
): NightlySources {
  return {
    master: () => git('rev-parse', '--verify', 'origin/master^{commit}'),
    async lastNightly() {
      try {
        return await git('rev-parse', '--verify', `refs/tags/${NIGHTLY_TAG}^{commit}`)
      } catch {
        return undefined
      }
    },
    async lastVersion() {
      try {
        // The nightly release is titled with its version.
        const title = await github([
          'release',
          'view',
          NIGHTLY_TAG,
          '--repo',
          repository,
          '--json',
          'name',
          '--jq',
          '.name'
        ])
        return title.trim() || undefined
      } catch (error) {
        // Only a missing release means none yet; any other failure must not reuse a version.
        if (error instanceof CommandError && /release not found/i.test(error.stderr)) {
          return undefined
        }
        throw error
      }
    },
    async masterVersion(commit) {
      return v.parse(manifestSchema, await git('show', `${commit}:package.json`)).version
    }
  }
}
