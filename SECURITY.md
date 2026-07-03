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

The MCP server uses a Unix domain socket as the primary transport, with optional TCP on `127.0.0.1`. An auth token is auto-generated on startup and stored in a discovery file with owner-only permissions (`0o600`). This prevents access from other users on the same machine. It does **not** prevent access from other processes running as the same user — any process owned by the same user can read the discovery file and authenticate.

The HTTP transport (`openpencil-mcp-http`) binds to `127.0.0.1` by default with `eval` disabled, CORS disabled, and file access restricted to the working directory. See [MCP docs](https://openpencil.dev/reference/mcp-tools) for configuration.

The stdio bridge (`openpencil-mcp`) connects to the MCP server via the Unix socket and sends the auth token on every request. It inherits the same auth requirements as direct connections.
