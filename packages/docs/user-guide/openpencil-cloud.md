---
title: OpenPencil Cloud
description: Keep documents on OpenPencil Cloud or your team's own server, share them, and edit them together.
---

# OpenPencil Cloud

OpenPencil Cloud keeps documents on a server so they follow you across devices and several people can edit them at once. Use the hosted service at `cloud.openpencil.dev` or a server your team runs itself ([self-hosting guide](/reference/self-hosting-cloud)). Cloud is optional: documents on your device and in your own [storage bucket](./cloud-storage) work the same with or without it.

## Connect a Server

Open **Settings → Cloud**. Until the hosted service opens, its card there takes your email for the waitlist; **Your team's server** asks for the address your team uses. OpenPencil checks that the address answers as an OpenPencil Cloud server before asking you to sign in, and says when nothing answers, when the address belongs to something else, or when the server runs a version this app doesn't support.

The ways to sign in come from the server: Google, Apple, or email and password.

- Email and password work right in the dialog, in the desktop app and in the web app at the server's own editor address. **Create an account** asks for your name, email, and a password of at least 8 characters, twice. The server emails you a link; open it, come back to OpenPencil, and signing in finishes by itself.
- Google and Apple, and accounts with two-step sign-in, finish in your browser: in the web app at the server's own editor address you come back to the same tab, and the desktop app shows a code to check against the browser's before you approve it.

Servers that review new accounts say so before you sign up. Until an administrator approves you, Settings shows that your account is waiting.

Each server in **Settings → Cloud** shows who is signed in to it:

- **Sign-in expired** keeps your account, so **Sign in** goes back to the same one.
- **Account and security** in the server's **…** menu opens the server's own account pages, as does **Account settings** in the **…** menu beside **OpenPencil Cloud** in Home's sidebar. See [Your Account](#your-account).
- **Sign out** ends the session on the server. If the server can't be reached, you stay signed in so you can try again. At the server's own editor address, signing out of that server goes back to its welcome page, unless the server lets you use its editor without an account and you chose to on this browser.
- **Disconnect server** signs you out and forgets the server on this device; your documents stay on it, and you can connect again anytime. It warns you when documents still have changes that haven't reached the server, because disconnecting discards them.

The desktop app keeps its sign-in in the system credential store. In the browser, a sign-in through the server's page lasts as long as the server's session; a sign-in with a code follows **Settings → General → Remember API keys on this device**.

## Your Account

A server's account pages have three parts:

- **Profile** shows your picture, name, and email, and your account ID, which an administrator may ask for. **Upload picture**, beside your picture, takes a PNG, JPEG, WebP, or GIF image; drag and zoom it to choose what shows in the circle, and **Remove**, once you confirm, goes back to your initials. **Change name** opens a dialog for your new name. Signing in with Google uses your Google picture until you upload one. The server keeps every picture itself, so pages never load them from Google or anywhere else. **Change email** sends a link to the new address, and your email changes once you open it. The old address gets a note saying which address is taking over. If you signed in a while ago, the server asks for your password first.
- **Sign-in and security** links Google or Apple, changes your password, and sets up two-step sign-in with an authenticator app or passkeys. Recovery codes are shown once: copy or download them before you close the dialog.
- **Sessions** lists every browser and desktop app signed in to your account, with when each was last active, and your recent sign-ins. Sign out any session you don't recognize, or all of them except the one you're using.

The server emails you when your account is signed in from an address it has never been signed in from, and when an authenticator app or a passkey is added or removed.

## Find Documents on Home

Home lists places in a sidebar: **Recent**, the workspaces of the server Home shows, **Shared with you**, and your storage bucket. On a phone the same places are in a menu above the documents. With more than one server connected, choose which one Home shows with **Show on Home** in Settings. At the server's own editor address, OpenPencil opens on Home, in your first workspace until you pick another place.

A workspace lists its documents with where each one stands, how much of the workspace's storage they use, and your role in it. Every account starts with a workspace of its own. **New design** creates a document in the workspace you are looking at, and says which one; in **Shared with you** it creates in your own workspace, and in Recent, or a workspace you can only view, it creates a file on your device. **Shared with you** lists documents people invited you to in workspaces you are not a member of.

## Work in a Team Workspace

Every account starts with a workspace of its own. To work with a team, select **+** beside **OpenPencil Cloud** in Home's sidebar, name the workspace, and you administer it. **Members** in the workspace's header has three tabs:

- **Members** lists who is in the workspace and when each person joined. Admins invite people by email as an admin, editor, or viewer, change roles, and remove people. Editors and admins change documents; viewers only look.
- **Invited**, for admins, lists invitations nobody has accepted yet, with who sent each one and when it expires. An invitation arrives by email; if the server doesn't send email, copy the invitation link from the dialog and pass it on. Invitations expire after seven days. **Resend** sends one again with a new link, and the earlier link stops working; so does inviting the same address again.
- **Settings** renames the workspace, and holds leaving and deleting it. Anyone can leave a workspace, except its last admin: make someone else an admin first. Admins can delete a workspace once it holds no documents. Deleted documents are kept for a while before they are gone for good, and the workspace can be deleted after that.

Opening a workspace invitation works like a document invitation: sign in with the invited address, choose **Join workspace**, and Home shows the workspace.

## Save a Document to Cloud

Open or create a document, then choose **File → Save to…**. When there is only one place it can go, it is saved there under its current name; with several workspaces, or a storage bucket too, pick one, and the last place you used is chosen first. Workspaces where you can only view are listed but can't be chosen. The Cloud copy opens in the same tab and saves as you work. A file you had open on your device keeps its last saved contents.

Saving can fail when the file is over the size the workspace allows, when the workspace is out of space, or when you are offline. Nothing changes on your device in those cases.

## Where a Document Stands

A Cloud document saves as you work, and the tab's dot shows edits that haven't reached the server yet, as it does for any file. When something needs you, a status appears beside the name; select it to see the workspace and server, and what you can do next.

| State                     | What it means                                                                                                                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Saved on this device**  | You are offline. Your changes are kept here and upload once you are back online.                                              |
| **Changed in two places** | Someone saved a newer version while you had changes the server didn't have.                                                   |
| **Couldn't save**         | The server refused the upload. Your changes are safe on this device; **Try again**, or sign in again if your sign-in expired. |
| **View only**             | You can look, select, copy, and follow others; the document can't be edited, so only Move and Hand are in the toolbar.        |

## When a Document Changed in Two Places

This happens when you edited a document offline, or before you joined a session, while someone else saved a newer version. Nothing is lost until you choose. Select the status beside the name, then **Choose a version**:

- **Keep both** leaves the newer version as it is and saves yours next to it as "(your copy)"; the tab moves to your copy.
- **Use the Cloud version** discards the changes on this device and shows the newer version.
- **Replace it with your version** uploads yours over the newer one for everyone.

**Decide later** keeps both versions until you come back to it.

## Version History

Choose **File → Show version history** to list a document's versions in the right sidebar, newest first, as Figma does. While the list is open the document is read-only.

- **Current version** is the document as it is now. Named versions show their title, description, who saved them, and when; autosaves, which the server keeps as you work, are titled by their time. The filter shows everyone's versions or only yours, and hides or shows autosaves.
- Select a version to look at it. It opens read-only where the document was, while the document itself stays as it is; select **Current version** or close the list to go back.
- **File → Save to version history…** (⌥⌘S), or **+** in the list, names the document as it is now with a title and what changed.
- A version's **⋯** menu edits or deletes its info, makes a new document from it with **Duplicate**, or brings it back with **Restore this version**. Restoring keeps the state it replaces in the history, closes the list, and moves everyone who has the document open on to the restored version.
- **Copy link** in the same menu copies a link that opens the document with that version shown.

People who can only view see the history and can copy links, but can't change it.

## Document Links

In the web app, the address bar shows the Cloud document you're looking at, and the version you have open in the history, so you can reload or pass the address on. Opening it signs you in to the document's server if needed, then opens the document for anyone with access to it. A link to a server you have never used only names the server; connect to it in **Settings → Cloud** first.

## Share a Document

Select **Share** on a Cloud document.

- Invite people by email with **Can edit** or **Can view**. They get an email with a link, and the invitation expires after seven days. Change someone's access or remove it from the list.
- Everyone in the document's workspace has the access the workspace gives them.
- Under **General access**, **Anyone with the link** lets people open the document with **Can view** or **Can edit**. Where the server allows it, they need no account; otherwise they sign in to the server first, and the dialog says which. Some workspaces' plans turn links off, and the dialog says so too.

The server keeps only a fingerprint of each link, so a link can be copied only on the device that created it. On other devices, **Reset link** makes a new one you can copy; the old link stops working.

## Open an Invitation

An invitation link opens OpenPencil with who invited you, to which document, and on which server. If you have never used that server, OpenPencil warns you to sign in only if you trust it. Sign in with the address the invitation was sent to; if you are signed in as someone else, choose **Use another account**. Once you accept, the document opens and stays under **Shared with you** on Home.

Invitation and share links open in the browser. If you use the desktop app, choose **Open in the desktop app** in the invitation, or on the notice that appears after a shared document opens; your browser asks before it switches to the app.

## Edit Together

Opening a Cloud document joins its live session: everyone who has it open sees each other's cursors and edits as they happen. One person's app saves the document for everyone, so editing together never makes your changes conflict with someone else's.

People who open a link without an account, where the server allows it, join under the name OpenPencil gives them, or the one they chose. They edit when the link allows it, but their app never saves to the server; someone signed in who can edit saves for them.

## AI on Cloud

When your workspace's plan includes AI and the server offers it, the AI assistant can use models through Cloud instead of a key of your own. In **Settings → AI**, add a model, choose **OpenPencil Cloud** as the provider, and pick the workspace whose plan pays for it; the models and their prices come from the server. **OpenPencil Cloud** is listed while you are signed in to the server Home shows.

Each request uses the workspace's AI credits for the month. When they run out, the assistant says so and, if the server bills, offers **Manage plan**. Self-hosted servers run their own AI service with their own models and limits ([self-hosting guide](/reference/self-hosting-cloud#ai)).
