# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities through public GitHub issues or pull requests.

If you believe you have found a security issue in OpenPencil, report it privately using GitHub Security Advisories:

https://github.com/open-pencil/open-pencil/security/advisories/new

Please include as much detail as possible:

- Affected version or commit
- Reproduction steps
- Proof of concept, if available
- Expected impact
- Whether the issue is already public

We will investigate privately before discussing details in public. If the report is confirmed, we will coordinate a fix and credit the reporter unless they prefer not to be named.

## Disclosure

Please give us a reasonable opportunity to investigate and release a fix before publishing details publicly.

## MCP server

The MCP HTTP transport (`openpencil-mcp-http`) binds to `127.0.0.1` by default with `eval` disabled, CORS disabled, and file access restricted to the working directory. See [MCP docs](https://openpencil.dev/reference/mcp-tools) for configuration.

These restrictions bind a client that connects to `/mcp` with the client token (`clientToken` in the discovery file). The server's own token (`authToken`) belongs to the app, the CLI, and the stdio transport: it also opens `/rpc` and `/files`, which they do not limit.

The stdio transport (`openpencil-mcp`) is intended for local use only and does not apply these restrictions.
