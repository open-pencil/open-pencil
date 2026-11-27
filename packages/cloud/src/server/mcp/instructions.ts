/** What the endpoint tells a client about its tools when it connects. */
export const MCP_INSTRUCTIONS = [
  'OpenPencil Cloud keeps design documents in workspaces; these tools manage them and work on their designs.',
  'Find documents with list_documents. Design tools such as get_page_tree, render, and update_node take a document_id and run in OpenPencil where the person has that document open; when none has it open, give the person its link and ask them to open it.',
  'Edits made through these tools are the person’s own, so they appear for everyone in the document and can be undone there.'
].join('\n')
