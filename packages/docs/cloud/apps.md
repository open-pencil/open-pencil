---
title: Connected Apps
description: Let apps such as ChatGPT, Claude, and Grok reach one OpenPencil Cloud workspace through OAuth and MCP, see what each app may do, and disconnect it.
---

# Connected Apps

A Cloud server can let apps work with your documents on your behalf, through OAuth, without you handing them a password or a token. A server accepts apps when its operator [turns them on](./self-hosting/#connected-apps); its account pages then show **Connected apps**.

## Connect an App

When an app asks to connect, it sends you to the server's **Connect an app** page. Sign in if you aren't, then check:

- **The app**: its name and the address it registered with. The server doesn't vouch for either, so connect only apps you trust.
- **What it may do**: read your documents, or read and change them. Apps that ask to stay connected keep working until you disconnect them; others stop after an hour.
- **Which workspace**: an app reaches one workspace, the one you pick. To use it with another, connect it again and pick that one.

**Allow** sends you back to the app; **Deny** tells it you refused. The page asks you again each time an app connects, so an app never gets a workspace you didn't pick.

An app reaches the workspace's documents, with their versions, images, and comments. It can't make workspaces, share documents or invite people, see who else is in the workspace, reach documents shared with you from elsewhere, or change anything about your account.

## Use Cloud in ChatGPT, Claude, and Grok

Apps that work with remote MCP servers can manage your Cloud documents and work on their designs. Add the server's MCP address, your server's address followed by `/mcp` (for example `https://cloud.example.com/mcp`), as a custom connector, keep OAuth as its sign-in, and connect: the app sends you to the **Connect an app** page above.

The app then has two kinds of tools:

- **Documents**: list the workspace's documents, create one, move one to Trash and back, and list or save versions. These work whether or not the document is open anywhere.
- **Design**: the tools OpenPencil's own [MCP server](../developers/mcp-server) has, such as reading the page tree, building layers from JSX, and changing them. They run in OpenPencil, in an editor where you have the document open and signed in as you, so open the document first; when it isn't open, the app gets its link to give you. You see the app at work on the canvas, everyone in the document sees its edits as yours, and you undo them as your own.

An app that may only read gets the reading tools alone.

## Disconnect an App

**Account → Connected apps** lists each app, the workspace it reaches, what it may do, and when you connected it. **Disconnect** stops it at once. An app also stops when you leave the workspace it reaches, or when your account is deleted.

Signing out of the browser you connected an app from doesn't disconnect it.

## For App Developers

The server is an OAuth 2.1 authorization server, and its document API at `/api` the protected resource:

- `/.well-known/oauth-protected-resource/api` names the resource and its authorization server (RFC 9728); a request without a valid token gets `401` with a `WWW-Authenticate` header pointing there.
- `/.well-known/oauth-authorization-server/api/auth` has the authorization server's metadata (RFC 8414), including its registration endpoint. Apps register themselves (RFC 7591) and use the authorization code flow with PKCE (`S256`).
- Scopes are `documents:read`, `documents:write` (which includes reading), and `offline_access` for a refresh token. Send the API's address as `resource` (RFC 8707).
- Access tokens start with `opa_`, last an hour, and are sent as `Authorization: Bearer <token>`. A route the token's scopes don't cover answers `403` with `insufficient_scope`; anything outside the granted workspace answers `404`.
- Instead of registering, an app may use the address of a client ID metadata document it serves as its `client_id` (`client_id_metadata_document_supported`), as MCP clients do. The server fetches it only from public addresses and never follows redirects.
- The MCP endpoint at `/mcp` (Streamable HTTP, stateless) is a protected resource too, described at `/.well-known/oauth-protected-resource/mcp`. A token for either resource reaches both, and each MCP tool is a request to the document API with the caller's token, so it reaches exactly what the token does. Personal access tokens work there as well.
- Design tools also run through the document API: `POST /api/documents/<id>/tools/read` and `/tools/write` take `{ "name": "<tool>", "args": { … } }`, and answer `409` with `editor_not_open` when nobody who may run the call has the document open.
