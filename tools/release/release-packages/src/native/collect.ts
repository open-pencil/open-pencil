import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import * as v from 'valibot'

import { resolveReportedAssets } from './artifacts.ts'
import { desktopAssets, desktopTargets } from './catalog.ts'
import { createReleaseContext } from './context.ts'
import { digestFile, targetManifestSchema } from './manifest.ts'

const { identity, paths, version } = createReleaseContext()
const target = v.parse(v.picklist(desktopTargets), process.env.RELEASE_TARGET)
const reported = JSON.parse(process.env.TAURI_ARTIFACT_PATHS ?? 'null')
const assets = await resolveReportedAssets(reported, desktopAssets(target, version), paths.root)

await mkdir(paths.nativeOutput, { recursive: true })

for (const asset of assets) {
  await copyFile(asset.source, join(paths.nativeOutput, asset.name))
}

const files = await Promise.all(
  assets.map(async ({ name }) => ({
    name,
    ...(await digestFile(join(paths.nativeOutput, name)))
  }))
)
const manifest = v.parse(targetManifestSchema, { ...identity, target, files })

await writeFile(join(paths.nativeOutput, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Collected ${files.length} reported files for ${target}`)
