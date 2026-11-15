---
title: OpenPencil Cloud
description: Keep documents on OpenPencil Cloud or your team's own server, share them, and edit them together.
---

# OpenPencil Cloud

OpenPencil Cloud keeps documents on a server so they follow you across devices and several people can edit them at once. Cloud is optional: documents on your device and in your own [storage bucket](/user-guide/cloud-storage) work the same with or without it.

## Hosted or Your Own Server

There are two ways to use Cloud, and the editor works the same with both:

- **The hosted service** at `cloud.openpencil.dev`, which the OpenPencil team runs. Its database, files, and collaboration rooms are in the European Union, and its [Terms of Service](./legal/terms), [Privacy Policy](./legal/privacy), and [subprocessors](./legal/subprocessors) are on this site. Until it opens, **Settings → Cloud** takes your email for the waitlist.
- **A server your team runs itself**, from the same open-source code ([self-hosting guide](./self-hosting/)). Its operator decides who can sign up, what plans and limits apply, and which terms and privacy policy you accept; this site's legal pages don't cover it.

| Page                                | What it covers                                                      |
| ----------------------------------- | ------------------------------------------------------------------- |
| [Your Account](./account)           | Profile, sign-in and security, sessions, terms, leaving a server    |
| [Documents](./documents)            | Saving, Home, document states, conflicts, version history, Trash   |
| [Sharing and Teams](./sharing)      | Invitations, links, team workspaces, editing together, reporting    |
| [AI on Cloud](./ai)                 | Models through your workspace plan's credits                        |
| [Support](./support)                | Where to ask for help                                               |

## Connect a Server

Open **Settings → Cloud**. **Your team's server** asks for the address your team uses. OpenPencil checks that the address answers as an OpenPencil Cloud server before asking you to sign in, and says when nothing answers, when the address belongs to something else, or when the server runs a version this app doesn't support.

The ways to sign in come from the server: Google, Apple, or email and password.

- Email and password work right in the dialog, in the desktop app and in the web app at the server's own editor address. **Create an account** asks for your name, email, and a password of at least 8 characters, twice. The server emails you a link; open it, come back to OpenPencil, and signing in finishes by itself.
- Google and Apple, and accounts with two-step sign-in, finish in your browser: in the web app at the server's own editor address you come back to the same tab, and the desktop app shows a code to check against the browser's before you approve it.

Servers that review new accounts say so before you sign up. Until an administrator approves you, Settings shows that your account is waiting.

Each server in **Settings → Cloud** shows who is signed in to it:

- **Sign-in expired** keeps your account, so **Sign in** goes back to the same one.
- **Account and security** in the server's **…** menu opens the server's own account pages, as does **Account settings** in the **…** menu beside **OpenPencil Cloud** in Home's sidebar. See [Your Account](./account).
- **Sign out** ends the session on the server. If the server can't be reached, you stay signed in so you can try again. At the server's own editor address, signing out of that server goes back to its welcome page, unless the server lets you use its editor without an account and you chose to on this browser.
- **Disconnect server** signs you out and forgets the server on this device; your documents stay on it, and you can connect again anytime. It warns you when documents still have changes that haven't reached the server, because disconnecting discards them.

The desktop app keeps its sign-in in the system credential store. In the browser, a sign-in through the server's page lasts as long as the server's session; a sign-in with a code follows **Settings → General → Remember API keys on this device**.
