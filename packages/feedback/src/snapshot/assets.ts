/**
 * What a release file is, from the names our release workflow gives them. Installers on
 * Windows and Linux double as their update packages; on macOS updates are their own archive, and
 * every running desktop app fetches `latest.json` when it checks for an update. Signatures,
 * checksums, and manifests are not counted.
 */
export type ReleaseFileKind =
  | 'macos-installer'
  | 'macos-update'
  | 'windows-installer'
  | 'linux-installer'
  | 'update-check'

const KINDS: [suffix: string, kind: ReleaseFileKind][] = [
  ['.app.tar.gz', 'macos-update'],
  ['.dmg', 'macos-installer'],
  ['.exe', 'windows-installer'],
  ['.msi', 'windows-installer'],
  ['.deb', 'linux-installer'],
  ['.rpm', 'linux-installer'],
  ['.AppImage', 'linux-installer']
]

export function releaseFileKind(name: string): ReleaseFileKind | undefined {
  if (name === 'latest.json') return 'update-check'
  return KINDS.find(([suffix]) => name.endsWith(suffix))?.[1]
}
