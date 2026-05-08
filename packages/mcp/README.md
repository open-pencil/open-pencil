# @open-pencil/mcp

MCP (Model Context Protocol) server for OpenPencil browser automation.

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Agent Apps  │     │   Browser RPC    │     │  Browser App     │
│ (via stdio) │────▶│   Bridge (port   │◀────│  (automation)    │
└─────────────┘     │   7601)          │     └──────────────────┘
                    │                  │
                    │  Multi-client    │
                    │  connection hub  │
                    └──────────────────┘
```
