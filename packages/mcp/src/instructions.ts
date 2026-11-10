/**
 * What an MCP client tells its model about OpenPencil's tools before the first call. Every tool
 * takes `document_id` and `page_id`, so they are described here once instead of in each schema.
 */
export const MCP_SERVER_INSTRUCTIONS = [
  'OpenPencil is a design editor; these tools read and edit the documents open in it.',
  'Read with get_page_tree, get_node, and describe; build layers from JSX with render, and change them with the set_* tools.',
  'A call works on the active document and page; pass document_id or page_id, from list_documents, to work on another.'
].join(' ')
