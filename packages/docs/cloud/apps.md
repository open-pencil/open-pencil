---
title: Connected Apps
description: Let apps reach one OpenPencil Cloud workspace through OAuth, see what each app may do, and disconnect it.
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

## Disconnect an App

**Account → Connected apps** lists each app, the workspace it reaches, what it may do, and when you connected it. **Disconnect** stops it at once. An app also stops when you leave the workspace it reaches, or when your account is deleted.

Signing out of the browser you connected an app from doesn't disconnect it.

## For App Developers

The server is an OAuth 2.1 authorization server, and its document API at `/api` the protected resource:

- `/.well-known/oauth-protected-resource/api` names the resource and its authorization server (RFC 9728); a request without a valid token gets `401` with a `WWW-Authenticate` header pointing there.
- `/.well-known/oauth-authorization-server/api/auth` has the authorization server's metadata (RFC 8414), including its registration endpoint. Apps register themselves (RFC 7591) and use the authorization code flow with PKCE (`S256`).
- Scopes are `documents:read`, `documents:write` (which includes reading), and `offline_access` for a refresh token. Send the API's address as `resource` (RFC 8707).
- Access tokens start with `opa_`, last an hour, and are sent as `Authorization: Bearer <token>`. A route the token's scopes don't cover answers `403` with `insufficient_scope`; anything outside the granted workspace answers `404`.
