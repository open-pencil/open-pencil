import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { publicPackageDirs } from './packages'

const rootDir = fileURLToPath(new URL('../../..', import.meta.url))
const tsgoBin = join(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsgo.cmd' : 'tsgo'
)

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

function bunEval(code: string, cwd: string): void {
  run(['bun', '--eval', code], cwd)
}

function writeTypeConsumer(cwd: string): void {
  writeFileSync(
    join(cwd, 'tsconfig.package-smoke.json'),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM'],
          typeRoots: [join(rootDir, 'node_modules', '@types')],
          skipLibCheck: true,
          noEmit: true
        },
        include: ['package-type-consumer.ts']
      },
      null,
      2
    ),
    'utf8'
  )

  writeFileSync(
    join(cwd, 'package-type-consumer.ts'),
    `import { createEditor, type Editor } from '@open-pencil/core'
import { htmlToDesignDocument, type DesignDocument } from '@open-pencil/dom-css'
import { FIG_PACKAGE_STATUS, type FigContainerDocument } from '@open-pencil/fig'
import { FIG_KIWI_DEFAULT_VERSION, buildFigKiwi } from '@open-pencil/kiwi/fig/container'
import { type GUID as KiwiGUID } from '@open-pencil/kiwi/fig'
import { type DiscoveryInfo } from '@open-pencil/mcp/discovery'
import { MCP_VERSION, type MCPResult, type ServerHandle } from '@open-pencil/mcp'
import { parsePenFile, type PenDocument } from '@open-pencil/pen'
import { SceneGraph, type Color, type SceneNode, type Vector } from '@open-pencil/scene-graph'
import {
  testIdSelector,
  type RequiredTestIdProps,
  type TestIdProps,
  type WithRequiredTestId,
  type WithoutTestId
} from '@open-pencil/vue'

const graph = new SceneGraph()
const editorFactory: typeof createEditor = createEditor
declare const editor: Editor
declare const designDocument: DesignDocument
declare const serverHandle: ServerHandle

const color: Color = { r: 1, g: 0.5, b: 0, a: 1 }
const vector: Vector = { x: 1, y: 2 }
const maybeNode: SceneNode | undefined = graph.getPages()[0]
const penDocument: PenDocument = { version: '1', children: [] }
const figDocument: FigContainerDocument = {
  schemaDeflated: new Uint8Array([1]),
  dataRaw: new Uint8Array([2])
}
const kiwiGuid: KiwiGUID = { sessionID: 1, localID: 2 }
const optionalTestId: TestIdProps = { testId: 'smoke' }
const requiredTestId: RequiredTestIdProps = { testId: 'required-smoke' }
const mergedTestId: WithRequiredTestId<{ label: string }> = {
  label: 'OpenPencil',
  testId: 'typed-smoke'
}
const withoutTestId: WithoutTestId<{ label: string; testId?: string }> = { label: 'clean' }
const discovery: DiscoveryInfo = {
  pid: 1,
  socketPath: '/tmp/open-pencil.sock',
  httpPort: 0,
  authRequired: false,
  authToken: null,
  version: MCP_VERSION,
  startedAt: new Date(0).toISOString()
}
const mcpResult: MCPResult = { content: [] }

void editorFactory
void editor
void designDocument
void serverHandle
void color
void vector
void maybeNode
void penDocument
void figDocument
void kiwiGuid
void optionalTestId
void requiredTestId
void mergedTestId
void withoutTestId
void discovery
void mcpResult
void FIG_PACKAGE_STATUS
void FIG_KIWI_DEFAULT_VERSION
void buildFigKiwi
void parsePenFile
void htmlToDesignDocument
void testIdSelector
`,
    'utf8'
  )
}

function checkTypeConsumer(cwd: string): void {
  writeTypeConsumer(cwd)
  run([tsgoBin, '--noEmit', '-p', 'tsconfig.package-smoke.json'], cwd)
}

interface PackageJson {
  name: string
  types?: string
  exports?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readPackageJson(packageDir: string): PackageJson {
  return JSON.parse(readFileSync(join(rootDir, packageDir, 'package.json'), 'utf8'))
}

function collectExportTypePaths(value: unknown, paths: string[] = []): string[] {
  if (typeof value === 'string') return paths
  if (!value || typeof value !== 'object') return paths
  for (const [key, child] of Object.entries(value)) {
    if (key === 'types' && typeof child === 'string') paths.push(child)
    else collectExportTypePaths(child, paths)
  }
  return paths
}

function packageArchivePath(path: string): string {
  return `package/${path.replace(/^\.\//, '')}`
}

function exportKeyToSpecifier(packageName: string, exportKey: string): string | null {
  if (exportKey === './package.json') return null
  if (exportKey === '.') return packageName
  if (!exportKey.startsWith('./')) {
    throw new Error(`${packageName}: unsupported export key ${exportKey}`)
  }
  if (exportKey.includes('*')) {
    throw new Error(
      `${packageName}: package smoke cannot exhaustively import pattern export ${exportKey}`
    )
  }
  return `${packageName}/${exportKey.slice(2)}`
}

function collectPublicImportSpecifiers(packageJSON: PackageJson): string[] {
  const { exports } = packageJSON
  if (!exports) return []
  if (typeof exports === 'string') return [packageJSON.name]
  if (!isRecord(exports)) return []

  const keys = Object.keys(exports)
  if (keys.length === 0) return []

  const hasExportMapKeys = keys.some((key) => key.startsWith('.'))
  if (!hasExportMapKeys) return [packageJSON.name]

  const specifiers: string[] = []
  for (const key of keys) {
    const specifier = exportKeyToSpecifier(packageJSON.name, key)
    if (specifier) specifiers.push(specifier)
  }
  return specifiers
}

const tempDir = mkdtempSync(join(tmpdir(), 'open-pencil-package-smoke-'))

try {
  run(['bun', 'run', 'build:packages'])

  const tarballs: string[] = []
  const publicImportSpecifiers = new Set<string>()
  for (const packageDir of publicPackageDirs) {
    const packageJSON = readPackageJson(packageDir)
    for (const specifier of collectPublicImportSpecifiers(packageJSON)) {
      publicImportSpecifiers.add(specifier)
    }
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

    const entries = new Set(contents.split('\n'))
    const typePaths = [
      ...(packageJSON.types ? [packageJSON.types] : []),
      ...collectExportTypePaths(packageJSON.exports)
    ]
    const missingTypePaths = typePaths
      .map(packageArchivePath)
      .filter((entry) => !entries.has(entry))
    if (missingTypePaths.length > 0) {
      console.error(
        `${basename(tarball)} is missing declared type files:\n${missingTypePaths.join('\n')}`
      )
      process.exit(1)
    }
  }

  run(['npm', 'init', '-y'], tempDir)
  run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs], tempDir)

  for (const specifier of [...publicImportSpecifiers].sort()) {
    nodeEval(`await import(${JSON.stringify(specifier)})`, tempDir)
    bunEval(`await import(${JSON.stringify(specifier)})`, tempDir)
  }

  checkTypeConsumer(tempDir)

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
  const cliDomInput = join(tempDir, 'dom-smoke.html')
  const cliDomOutput = join(tempDir, 'dom-smoke.json')
  writeFileSync(cliDomInput, '<article class="card"><h1>Node CLI DOM smoke</h1></article>', 'utf8')
  const cliDomSummary = JSON.parse(
    run(
      [
        'node',
        'node_modules/.bin/openpencil',
        'dom',
        cliDomInput,
        '--format',
        'json',
        '--output',
        cliDomOutput,
        '--json'
      ],
      tempDir
    )
  )
  const cliDomDocument = JSON.parse(readFileSync(cliDomOutput, 'utf8'))
  if (cliDomSummary.format !== 'json' || cliDomDocument.children[0]?.tagName !== 'article') {
    throw new Error('CLI DOM Node smoke failed')
  }
  run(['node', 'node_modules/.bin/openpencil-mcp', '--help'], tempDir)
  run(['node', 'node_modules/.bin/openpencil-mcp-http', '--help'], tempDir)

  console.log('Packed package smoke tests passed.')
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}
