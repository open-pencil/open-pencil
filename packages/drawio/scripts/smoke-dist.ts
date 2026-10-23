export {}

const mod = await import('../dist/index.js')

const file = mod.parseDrawioFile(
  '<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel>'
)

if (file?.pages[0]?.cells.length !== 1 || !mod.writeDrawioFile(file).includes('value="A"')) {
  throw new Error('Expected built draw.io package to read and write a diagram')
}
