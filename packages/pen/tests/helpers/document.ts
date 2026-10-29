import { parsePenFile, type PenDocument, type PenNode, type PenReadOptions } from '@open-pencil/pen'

/** Reads a document holding `children`, as pen.dev 2.21 writes it. */
export function parseDocument(
  children: PenNode[],
  fields: Partial<PenDocument> = {},
  options: PenReadOptions = {}
) {
  return parsePenFile(JSON.stringify({ version: '2.21', ...fields, children }), options)
}
