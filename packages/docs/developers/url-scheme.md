---
title: URL scheme
description: Link a published page straight to a layer, with openpencil:// for the desktop app and ?file= for the web app.
---

# URL scheme

The desktop app registers `openpencil://`, so a published page — a Storybook story, a design review, a README — can link straight to a layer:

```
openpencil://open?file=web/design/hikyo.pen&node=Button/Large/Default
```

`file` is a repository-relative path ending in `.pen` or `.fig`; absolute paths and `.` or `..` segments are refused. `node` is optional. Both values are URL-encoded — path separators may stay literal, but a literal `+` must be sent as `%2B` — and a repeated key takes its last value.

The app matches `file` against the paths of the open tabs as a whole trailing segment sequence, and focuses that tab without re-reading the document, so a file that moved or turned unreadable since it opened still gets its layer selected. The first open tab whose path ends with the requested path wins, which matters when two checkouts have the same file open. Segments are compared the way the platform's filesystem does: ASCII-case-insensitively on macOS and Windows, exactly on Linux, so `Web/Design/hikyo.pen` and `web/design/hikyo.pen` are the same file on a Mac and two different ones on Linux. If no open tab matches, a file picker asks for the file once; the picked file must end with the same relative path, otherwise the link is cancelled. No path is joined onto a root and no filesystem access is granted beyond what the picker returns. A file the link actually opens — the picked one — joins the recent-files list like any other file you open; focusing a tab that was already open does not touch the list, because nothing was opened.

With a node name, the app selects every layer carrying that exact name on the current page and zooms the view to the whole selection. When the current page has none, it switches to the first page that does, loading pages as needed. An unknown name shows a notice and leaves the document open. Opening a file and selecting layers is all the scheme can do.

The web app takes the same link from its own address bar:

```
https://app.openpencil.dev/?file=https://raw.githubusercontent.com/open-pencil/open-pencil/master/tests/fixtures/pencil_button.pen&node=Button/Large/Default
```

Here `file` is an absolute `https:` URL ending in `.pen` or `.fig` — the web app has no filesystem, so a relative path, an `http:` URL or any other extension is refused with a console warning and nothing else. The extension is read off the URL's path, so a query string on the linked file changes nothing. A fragment is dropped before the fetch: it never reaches the server, so `…/hikyo.pen#a` and `…/hikyo.pen#b` open one tab, not two. `node` behaves exactly as above: the same exact-name selection and zoom, the same notice when no layer carries the name. Both values are URL-encoded, a literal `+` must be sent as `%2B`, and a repeated key takes its last value, as on the desktop. The link is handled on any route, so `/share/<room>?file=…` and `/demo?file=…` work like `/?file=…`.

The browser fetches the file cross-origin, so the host must allow it: `raw.githubusercontent.com` sends `Access-Control-Allow-Origin: *` and works. The request carries no credentials and refuses to follow redirects, which keeps an `https:` link from being bounced to a plaintext one — a `https://github.com/<owner>/<repo>/raw/...` URL redirects to `raw.githubusercontent.com` and is therefore refused, so link to the raw host directly. `file` and `node` are stripped from the address bar through the router as soon as they are read — before the fetch, and also when the link was refused — so a reload does not re-open the document, and neither a copied URL nor a later in-app navigation carries the link payload. A linked document is capped at 64 MiB: the body is counted as it streams in, not trusted from `Content-Length`, and the request is aborted the moment it goes over, with the link reporting that the file exceeds 64 MiB. A deployment that serves the app under a Content-Security-Policy must allow the linked host in `connect-src`, otherwise the fetch is blocked and the link reports that it could not open the file.

On macOS the scheme belongs to the installed app bundle, so links reach an installed build and not a `tauri dev` process. On Windows and Linux the link arrives through the deep-link plugin, including when the app is not running yet: the link is queued at startup and handled once the editor is ready; on Linux the bundled desktop entry passes the link through `%U`.
