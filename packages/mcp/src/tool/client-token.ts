import { bytesToHex } from '@noble/hashes/utils.js'

/** Names what the key is derived for, so the same server token never yields this value elsewhere. */
const CLIENT_TOKEN_CONTEXT = 'openpencil-mcp-client-token-v1'

/**
 * The token an MCP client connects with, worked out from the server's own token. The server's
 * token also registers the app, sends raw commands through `/rpc`, and reads and writes files
 * through `/files`, none of which the tool settings limit. A client holding only this one reaches
 * `/mcp`, where eval, the tool switches, the file root, and the scope apply, and it cannot work
 * the server's token back out: the value is an HMAC-SHA-256 keyed with that token.
 */
export async function mcpClientToken(serverToken: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serverToken),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(CLIENT_TOKEN_CONTEXT))
  )
  return bytesToHex(mac)
}
