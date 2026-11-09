import { basename, join } from 'node:path'

import { desktopTargets } from '#release/native/catalog'

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
  /**
   * The directory that ships the notices, an npm package's for a package, and their path inside
   * it. The release writes them there before packing or bundling.
   */
  directory: string
  notices: string
}

/**
 * The desktop app's Rust notices inside `desktop/`: generated, so the shared frontend archive
 * carries them to every native build, which bundles them (`native/frontend.ts`).
 */
export const DESKTOP_RUST_NOTICES = 'generated/THIRD-PARTY-NOTICES.md'

export const NOTICED_ARTIFACTS: readonly NoticedArtifact[] = [
  {
    name: 'html-engine.wasm',
    manifest: 'packages/html-engine/crate/Cargo.toml',
    deny: 'packages/html-engine/deny.toml',
    targets: ['wasm32-unknown-unknown'],
    directory: 'packages/html-engine',
    notices: 'wasm/THIRD-PARTY-NOTICES.md'
  },
  {
    name: 'OpenPencil desktop app',
    manifest: 'desktop/Cargo.toml',
    deny: 'desktop/deny.toml',
    targets: desktopTargets,
    directory: 'desktop',
    notices: DESKTOP_RUST_NOTICES
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
    if (!packageDirectories.includes(artifact.directory)) continue
    const notices = join(prepared, basename(artifact.directory), artifact.notices)
    if (!(await Bun.file(notices).exists())) {
      throw new Error(`${artifact.directory} lacks ${artifact.notices}; run notices before prepare`)
    }
  }
}
