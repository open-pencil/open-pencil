import { releaseVersion } from '../native/context.ts'

export interface ChromiumSource {
  /** The version in the Chromium branch's `desktop/tauri.conf.json`. */
  configVersion: string
  tag: string
  tagCommit: string
  /** Where the Chromium branch last merged master. */
  masterBase: string
}

/**
 * A Chromium build of a release ships that release's code under its version, so the branch must
 * have merged exactly the release tag from master: no earlier master, and nothing master added
 * after the tag. Returns the release version.
 */
export function assertChromiumSource({
  configVersion,
  tag,
  tagCommit,
  masterBase
}: ChromiumSource): string {
  const version = releaseVersion(tag)

  if (configVersion !== version) {
    throw new Error(
      `The Chromium branch is at ${configVersion}, not ${version}; merge ${tag} into it`
    )
  }
  if (masterBase !== tagCommit) {
    throw new Error(
      `The Chromium branch last merged master at ${masterBase}, not ${tag} (${tagCommit}); merge exactly ${tag} into it`
    )
  }

  return version
}
