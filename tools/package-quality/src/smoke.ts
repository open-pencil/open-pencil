import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { publicPackageDirs } from './packages'

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))

function run(command: string[], cwd = rootDir): string {
  const proc = Bun.spawnSync(command, { cwd, stdout: 'pipe', stderr: 'pipe' })
  const stdout = proc.stdout.toString()
  const stderr = proc.stderr.toString()
  if (!proc.success) {
    console.error(`$ ${command.join(' ')}`)
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    process.exit(proc.exitCode || 1)
  }
  return stdout.trim()
}

function nodeEval(code: string, cwd: string): void {
  run(['node', '--input-type=module', '--eval', code], cwd)
}

const tempDir = mkdtempSync(join(tmpdir(), 'open-pencil-package-smoke-'))

try {
  run(['bun', 'run', 'build:packages'])

  const tarballs: string[] = []
  for (const packageDir of publicPackageDirs) {
    const output = run(
      ['bun', 'pm', 'pack', '--destination', tempDir, '--quiet'],
      join(rootDir, packageDir)
    )
    const filename = output
      .split('\n')
      .map((line) => line.trim())
      .findLast((line) => line.length > 0)
    if (!filename) throw new Error(`No tarball produced for ${packageDir}`)
    const tarball = filename.startsWith('/') ? filename : join(tempDir, filename)
    tarballs.push(tarball)

    const contents = run(['tar', '-tf', tarball])
    const runtimeTs = contents
      .split('\n')
      .filter((entry) => /package\/src\/.*\.ts$/.test(entry) && !entry.endsWith('.d.ts'))
    if (runtimeTs.length > 0) {
      console.error(`${basename(tarball)} includes runtime TypeScript:\n${runtimeTs.join('\n')}`)
      process.exit(1)
    }
  }

  run(['npm', 'init', '-y'], tempDir)
  run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], tempDir)

  nodeEval("await import('@open-pencil/kiwi')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/schema-runtime')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/codec')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/container')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/guid')", tempDir)
  nodeEval("await import('@open-pencil/kiwi/fig/parse')", tempDir)
  nodeEval("await import('@open-pencil/fig')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/copy')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/coordinate')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/geometry')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/images')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/matrix')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/parse-path')", tempDir)
  nodeEval("await import('@open-pencil/scene-graph/primitives')", tempDir)
  nodeEval("await import('@open-pencil/pen')", tempDir)
  nodeEval("await import('@open-pencil/core')", tempDir)
  nodeEval("await import('@open-pencil/dom-css')", tempDir)
  nodeEval("await import('@open-pencil/dom-css/browser')", tempDir)
  nodeEval("await import('@open-pencil/dom-css/jsx-runtime')", tempDir)
  nodeEval("await import('@open-pencil/dom-css/jsx-dev-runtime')", tempDir)
  nodeEval("await import('@open-pencil/vue')", tempDir)
  nodeEval("await import('@open-pencil/mcp')", tempDir)

  nodeEval(
    "const { guidToString } = await import('@open-pencil/kiwi/fig/guid'); if (guidToString({ sessionID: 1, localID: 2 }) !== '1:2') throw new Error('Kiwi GUID subpath failed')",
    tempDir
  )
  nodeEval(
    "const { buildFigKiwi, parseFigKiwiChunks } = await import('@open-pencil/kiwi/fig/container'); const chunks = parseFigKiwiChunks(buildFigKiwi(new Uint8Array([1]), new Uint8Array([2]))); if (chunks?.length !== 2) throw new Error('Kiwi container subpath failed')",
    tempDir
  )
  nodeEval(
    "const { FIG_PACKAGE_STATUS, readFigContainer, writeFigContainer } = await import('@open-pencil/fig'); if (FIG_PACKAGE_STATUS !== 'container-api') throw new Error('Fig package status smoke failed'); const document = readFigContainer(writeFigContainer({ schemaDeflated: new Uint8Array([1]), dataRaw: new Uint8Array([2]) })); if (document.dataRaw[0] !== 2) throw new Error('Fig container smoke failed')",
    tempDir
  )
  nodeEval(
    "const { SceneGraph } = await import('@open-pencil/scene-graph'); const graph = new SceneGraph(); if (graph.getPages().length !== 1) throw new Error('SceneGraph package smoke failed')",
    tempDir
  )
  nodeEval(
    "const { parsePenFile } = await import('@open-pencil/pen'); const graph = parsePenFile(JSON.stringify({ version: '1', children: [{ id: 'frame', type: 'frame', width: 100, height: 50 }] })); if (graph.getPages()[0].childIds.length !== 1) throw new Error('Pen package smoke failed')",
    tempDir
  )
  nodeEval(
    "const { htmlToSceneGraph } = await import('@open-pencil/dom-css'); const graph = await htmlToSceneGraph('<div class=card>OpenPencil</div>', { cssText: '.card { width: 320px; }' }); if (graph.getPages()[0].width !== 320) throw new Error('DOM/CSS scene graph smoke failed')",
    tempDir
  )
  nodeEval(
    "const browser = await import('@open-pencil/dom-css/browser'); for (const key of ['browserHTMLToDesignDocument', 'browserHTMLToSceneGraph', 'browserTailwindJSXToSceneGraph']) if (typeof browser[key] !== 'function') throw new Error('DOM/CSS browser export missing: ' + key)",
    tempDir
  )
  nodeEval(
    "const { jsx, jsxToDesignDocument } = await import('@open-pencil/dom-css/jsx-runtime'); const document = await jsxToDesignDocument(jsx('section', { class: 'card', style: { width: '120px' }, children: 'OpenPencil' })); const node = document.children[0]; if (node?.type !== 'element' || node.inlineStyle?.width !== '120px') throw new Error('DOM/CSS JSX runtime smoke failed')",
    tempDir
  )

  run(['node', 'node_modules/.bin/openpencil', '--help'], tempDir)
  run(['node', 'node_modules/.bin/openpencil-mcp', '--help'], tempDir)
  run(['node', 'node_modules/.bin/openpencil-mcp-http', '--help'], tempDir)

  console.log('Packed package smoke tests passed.')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
