import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'

import { $ } from 'bun'

import { SkiaRenderer } from '@open-pencil/core/canvas'
import { initCanvasKit, renderNodesToImage } from '@open-pencil/core/io'
import { prepareGraphFonts } from '@open-pencil/core/text'
import { parseFigBuffer } from '@open-pencil/fig'
import {
  interpretInstance,
  materializeInstance,
  type InstanceOccurrence,
  type InstancePathDiagnostic
} from '@open-pencil/fig/instance-overrides'
import { nodeChangeToProps } from '@open-pencil/fig/node-change'
import { guidToString } from '@open-pencil/kiwi/fig/guid'
import { SceneGraph } from '@open-pencil/scene-graph'

// Render the interpreter output directly. No legacy import, export/reimport, or layout pass.
const { values } = parseArgs({
  options: {
    file: { type: 'string' },
    node: { type: 'string' },
    output: { type: 'string' },
    scale: { type: 'string', default: '2' },
    'figma-key': { type: 'string' }
  }
})
if (!values.file || !values.node || !values.output)
  throw new Error('Required: --file --node --output')
const scale = Number(values.scale)
if (!Number.isFinite(scale) || scale <= 0 || scale > 8)
  throw new Error('Scale must be > 0 and <= 8')
await mkdir(values.output, { recursive: true })
const { nodeChanges, blobs, images } = parseFigBuffer(await Bun.file(values.file).arrayBuffer())
const diagnostics: InstancePathDiagnostic[] = []
const occurrence = interpretInstance(nodeChanges, values.node, {
  derivedBounds: true,
  onUnresolvedProperty: (d) => diagnostics.push(d)
})
const graph = new SceneGraph()
const page = graph.getPages()[0]
for (const [hash, bytes] of images) graph.images.set(hash, bytes)
const sources = new Map(
  nodeChanges.flatMap((node) => (node.guid ? [[guidToString(node.guid), node] as const] : []))
)
const components = new Map<string, string>()
function prepare(node: InstanceOccurrence): void {
  if (node.mainComponentId && !components.has(node.mainComponentId)) {
    const source = sources.get(node.mainComponentId)
    if (!source) throw new Error('Missing source component')
    const { nodeType, ...props } = nodeChangeToProps(source, blobs)
    if (nodeType !== 'COMPONENT') throw new Error('Expected terminal component')
    components.set(node.mainComponentId, graph.createNode('COMPONENT', page.id, props).id)
  }
  node.children.forEach(prepare)
}
prepare(occurrence)
const result = materializeInstance(graph, page.id, occurrence, components, blobs)
const bounds = () => [...result.nodes.values()].map((n) => [n.id, n.x, n.y, n.width, n.height])
const before = JSON.stringify(bounds())
const ck = await initCanvasKit()
const surface = ck.MakeSurface(1, 1)
if (!surface) throw new Error('No Skia surface')
const renderer = new SkiaRenderer(ck, surface)
try {
  await renderer.loadFonts()
  const fonts = await prepareGraphFonts(graph, [result.root.id])
  if (!fonts.faithful) throw new Error(`Missing fonts: ${JSON.stringify(fonts)}`)
  const png = renderNodesToImage(ck, renderer, graph, page.id, [result.root.id], {
    scale,
    format: 'PNG',
    trimTransparent: false
  })
  if (!png) throw new Error('No rendered image')
  if (before !== JSON.stringify(bounds()))
    throw new Error('Render preparation changed occurrence bounds')
  await Bun.write(join(values.output, 'interpreted.png'), png)
  await Bun.write(
    join(values.output, 'report.json'),
    JSON.stringify(
      { file: values.file, node: values.node, scale, fonts, diagnostics, bounds: bounds() },
      null,
      2
    )
  )
} finally {
  renderer.destroy()
}
if (values['figma-key']) {
  const code = `if(figma.fileKey!==${JSON.stringify(values['figma-key'])})throw Error("Wrong Figma document");const n=await figma.getNodeByIdAsync(${JSON.stringify(values.node)});if(!n||!("exportAsync"in n))throw Error("Missing export node");return {png:figma.base64Encode(await n.exportAsync({format:"PNG",constraint:{type:"SCALE",value:${scale}}})),bounds:n.absoluteRenderBounds}`
  const exported = (await $`figma-use eval --json --timeout 60 ${code}`.json()) as {
    png: string
    bounds: unknown
  }
  await Bun.write(join(values.output, 'figma.png'), Buffer.from(exported.png, 'base64'))
  await Bun.write(
    join(values.output, 'figma-bounds.json'),
    JSON.stringify(exported.bounds, null, 2)
  )
}
console.log(`Wrote direct-render artifacts to ${values.output}`)
