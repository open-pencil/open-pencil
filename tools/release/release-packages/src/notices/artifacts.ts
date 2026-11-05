import { basename, join } from 'node:path'

/**
 * What a release ships with Rust crates compiled into it, and where each one's third-party
 * notices go. MIT, BSD, and Apache-2.0 require a redistributed binary to carry its crates'
 * copyright notices and license texts, and MPL-2.0 to say where their source is, so every
 * artifact that compiles crates in has an entry here.
 */
export interface NoticedArtifact {
  name: string
  /** The crate's manifest, relative to the workspace root. */
  manifest: string
  /** The `cargo deny` configuration whose license allowlist the notices accept. */
  deny: string
  /** The targets the artifact is built for; crates only other targets need are left out. */
  targets: readonly string[]
  /** The npm package that ships the notices, by its directory, and their path inside it. */
  packageDirectory: string
  notices: string
}

export const NOTICED_ARTIFACTS: readonly NoticedArtifact[] = [
  {
    name: 'html-engine.wasm',
    manifest: 'packages/html-engine/crate/Cargo.toml',
    deny: 'packages/html-engine/deny.toml',
    targets: ['wasm32-unknown-unknown'],
    packageDirectory: 'packages/html-engine',
    notices: 'wasm/THIRD-PARTY-NOTICES.md'
  }
]

/**
 * Fails when a package that ships compiled crates lacks their notices in its prepared directory,
 * which the release writes with `notices` before `prepare`, so no release publishes the binary
 * without them. `packageDirectories` are the packages the release publishes.
 */
export async function assertNoticesPrepared(
  prepared: string,
  packageDirectories: readonly string[],
  artifacts: readonly NoticedArtifact[] = NOTICED_ARTIFACTS
): Promise<void> {
  for (const artifact of artifacts) {
    if (!packageDirectories.includes(artifact.packageDirectory)) continue
    const notices = join(prepared, basename(artifact.packageDirectory), artifact.notices)
    if (!(await Bun.file(notices).exists())) {
      throw new Error(
        `${artifact.packageDirectory} lacks ${artifact.notices}; run notices before prepare`
      )
    }
  }
}
