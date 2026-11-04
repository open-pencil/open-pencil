import { expect, test } from 'bun:test'

import { parseDrawIOFile, writeDrawIOFile } from '@open-pencil/drawio'

const MODEL = `<mxGraphModel grid="1"><root>
  <mxCell id="0"/><mxCell id="1" parent="0"/>
  <mxCell id="notes" value="Notes" style="locked=1;" parent="0" visible="0"/>
  <mxCell id="a" value="A &amp; B" style="ellipse;fillColor=#fff2cc;" vertex="1" parent="1">
    <mxGeometry x="40" y="60" width="120" height="60" as="geometry">
      <Array as="points"><mxPoint x="10" y="20"/></Array>
    </mxGeometry>
  </mxCell>
  <UserObject label="Linked" link="https://example.com" placeholders="1" id="b">
    <mxCell style="rounded=1;" vertex="1" parent="notes">
      <mxGeometry x="300" y="60" width="120" height="60" as="geometry"/>
    </mxCell>
  </UserObject>
  <mxCell id="e" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" parent="1" source="a">
    <mxGeometry relative="1" as="geometry">
      <mxPoint x="500" y="90" as="targetPoint"/>
      <Array as="points"><mxPoint x="240" y="90"/></Array>
    </mxGeometry>
  </mxCell>
  <mxCell id="l" value="next" style="edgeLabel;" vertex="1" parent="e">
    <mxGeometry x="0.5" relative="1" as="geometry"><mxPoint x="2" y="-8" as="offset"/></mxGeometry>
  </mxCell>
</root></mxGraphModel>`

test('a written file reads back as the file it was written from', () => {
  const file = parseDrawIOFile(`<mxfile><diagram id="p" name="Page">${MODEL}</diagram></mxfile>`)
  if (!file) throw new Error('Fixture did not read')
  const written = writeDrawIOFile(file)
  expect(written).toStartWith('<mxfile host="OpenPencil">')
  // Saved uncompressed, as draw.io saves by default.
  expect(written).toContain('<mxGraphModel grid="1"><root><mxCell id="0"/>')
  expect(parseDrawIOFile(written)).toEqual(file)
})

test('a file with pages it could not read is not written, since they would be lost', () => {
  const file = parseDrawIOFile(
    `<mxfile><diagram id="p" name="Page">${MODEL}</diagram><diagram id="q" name="Broken">!</diagram></mxfile>`
  )
  if (!file) throw new Error('Fixture did not read')
  expect(() => writeDrawIOFile(file)).toThrow('Could not write the draw.io pages Broken')
})
