export {}

const mod = await import('../dist/index.js')

const graph = mod.parsePenFile(
  JSON.stringify({
    version: '1',
    children: [{ id: 'frame', type: 'frame', name: 'Frame', width: 100, height: 50 }]
  })
)

if (graph.getPages()[0]?.childIds.length !== 1) {
  throw new Error('Expected built Pen package to parse a document')
}
