export const MCP_CORS_METHODS = ['GET', 'POST', 'DELETE', 'OPTIONS']

// x-mcp-token: OpenPencil extension for MCP clients that cannot set the
// Authorization header (e.g. some IDE plugins). Not part of the MCP spec.
export const MCP_CORS_HEADERS = [
  'Content-Type',
  'Authorization',
  'x-mcp-token',
  'mcp-session-id',
  'Last-Event-ID',
  'mcp-protocol-version'
]

export const MCP_EXPOSED_HEADERS = ['mcp-session-id', 'mcp-protocol-version']
