import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { resolveReportedAssets } from '#release/native/artifacts'
import { desktopAssets } from '#release/native/catalog'

const expected = desktopAssets('aarch64-apple-darwin', '0.15.0')

async function withArtifacts(run: (root: string, reported: string[]) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'release-artifacts-'))

  try {
    const reported: string[] = []

    for (const asset of expected) {
      for (const name of asset.signed ? [asset.source, `${asset.source}.sig`] : [asset.source]) {
        const path = join(root, name)
        await writeFile(path, 'fixture')
        reported.push(path)
      }
    }

    await run(root, reported)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('uses reported paths and retains the stable macOS archive name', () =>
  withArtifacts(async (root, reported) => {
    const app = join(root, 'OpenPencil.app')
    await mkdir(app)
    await writeFile(join(root, 'unrelated-file.dmg'), 'not reported')

    const assets = await resolveReportedAssets([...reported, app], expected, root)

    expect(assets.map((asset) => asset.name).sort()).toEqual([
      'OpenPencil_0.15.0_aarch64.dmg',
      'OpenPencil_aarch64.app.tar.gz',
      'OpenPencil_aarch64.app.tar.gz.sig'
    ])
  }))

test('does not discover an existing signature missing from the action output', () =>
  withArtifacts(async (root, reported) => {
    await expect(
      resolveReportedAssets(
        reported.filter((path) => !path.endsWith('.sig')),
        expected,
        root
      )
    ).rejects.toThrow('Missing reported artifacts')
  }))

test('rejects duplicate reports', () =>
  withArtifacts(async (root, reported) => {
    await expect(resolveReportedAssets([...reported, ...reported], expected, root)).rejects.toThrow(
      'Duplicate reported artifact'
    )
  }))

test('rejects additional reported files', () =>
  withArtifacts(async (root, reported) => {
    const extra = join(root, 'unexpected.exe')
    await writeFile(extra, 'fixture')

    await expect(resolveReportedAssets([...reported, extra], expected, root)).rejects.toThrow(
      'Unexpected reported artifact'
    )
  }))

test('rejects symlink escapes', () =>
  withArtifacts(async (root, reported) => {
    const source = join(root, 'source')
    await mkdir(source)
    await symlink(reported[0] ?? '', join(source, 'outside.dmg'))

    await expect(
      resolveReportedAssets([join(source, 'outside.dmg')], expected, source)
    ).rejects.toThrow('escapes source checkout')
  }))
