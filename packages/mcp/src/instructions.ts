/**
 * What an MCP client tells its model about OpenPencil's tools before the first call. The tools that
 * work on a document take `document_id` and `page_id`, described here once instead of in each schema.
 */
export const MCP_SERVER_INSTRUCTIONS = [
  'OpenPencil is a design editor; these tools read and edit the documents open in it.',
  'Read with get_page_tree, get_node, and describe; build layers from JSX with render, and change them with update_node and the set_* tools.',
  "A call works on the active document and page, or an app chat's own document.",
  'Tools that work on a document take document_id and page_id from list_documents: page_id alone picks a page of that document, and a page in another document needs both.'
].join(' ')
