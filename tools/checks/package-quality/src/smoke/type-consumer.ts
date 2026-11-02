import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { runCommand } from '@lawha/package-artifacts-tools'

const TYPE_CONSUMER = `import { createEditor, type Editor } from '@lawha/core'
import { Frame, type TreeNode } from '@lawha/design-jsx'
import { htmlToDesignDocument, type DesignDocument } from '@lawha/dom-css'
import { parseDrawIOFile, type DrawIOFile } from '@lawha/drawio'
import { FIG_PACKAGE_STATUS, type FigContainerDocument } from '@lawha/fig'
import { FIG_KIWI_DEFAULT_VERSION, buildFigKiwi } from '@lawha/kiwi/fig/container'
import type { GUID as KiwiGUID } from '@lawha/kiwi/fig'
import { parseFlowchart, type Flowchart } from '@lawha/mermaid'
import { parsePenFile, type PenDocument } from '@lawha/pen'
import { SceneGraph, type SceneNode } from '@lawha/scene-graph'
import type { Color, Vector } from '@lawha/scene-graph/primitives'
import { testIdSelector } from '@lawha/vue/testing'

const graph = new SceneGraph()
const editorFactory: typeof createEditor = createEditor
declare const editor: Editor
declare const designDocument: DesignDocument
const color: Color = { r: 1, g: 0.5, b: 0, a: 1 }
const vector: Vector = { x: 1, y: 2 }
const tree: TreeNode = Frame({ w: 100 })
const maybeNode: SceneNode | undefined = graph.getPages()[0]
const penDocument: PenDocument = { version: '1', children: [] }
const figDocument: FigContainerDocument = { schemaDeflated: new Uint8Array([1]), dataRaw: new Uint8Array([2]) }
const kiwiGuid: KiwiGUID = { sessionID: 1, localID: 2 }
const drawioFile: DrawIOFile | null = parseDrawIOFile('<mxfile/>')
const flowchart: Flowchart = parseFlowchart('flowchart LR\\n  A --> B')
void editorFactory; void editor; void designDocument; void color; void vector; void maybeNode
void penDocument; void figDocument; void kiwiGuid; void FIG_PACKAGE_STATUS
void FIG_KIWI_DEFAULT_VERSION; void buildFigKiwi; void parsePenFile; void htmlToDesignDocument
void testIdSelector; void tree; void drawioFile; void flowchart
`

export async function verifyTypeConsumer(root: string, consumerDirectory: string): Promise<void> {
  await writeFile(
    join(consumerDirectory, 'tsconfig.package-smoke.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM'],
          typeRoots: [join(root, 'node_modules', '@types')],
          skipLibCheck: true,
          noEmit: true
        },
        include: ['package-type-consumer.ts']
      },
      null,
      2
    )}\n`
  )
  await writeFile(join(consumerDirectory, 'package-type-consumer.ts'), TYPE_CONSUMER)
  const executable = join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
  )
  await runCommand({
    command: executable,
    args: ['--noEmit', '-p', 'tsconfig.package-smoke.json'],
    cwd: consumerDirectory,
    timeoutMs: 30_000
  })
}
