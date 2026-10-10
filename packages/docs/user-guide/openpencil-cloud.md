---
title: OpenPencil Cloud
description: Keep documents on OpenPencil Cloud or your team's own server, share them, and edit them together.
---

# OpenPencil Cloud

OpenPencil Cloud keeps documents on a server so they follow you across devices and several people can edit them at once. Use the hosted service at `cloud.openpencil.dev` or a server your team runs itself. Cloud is optional: documents on your device and in your own [storage bucket](./cloud-storage) work the same with or without it.

## Connect a Server

Open **Settings → OpenPencil Cloud** and choose **OpenPencil Cloud**, or **Your team's server** and enter the address your team uses. OpenPencil checks that the address answers as an OpenPencil Cloud server before asking you to sign in, and says when nothing answers, when the address belongs to something else, or when the server runs a version this app doesn't support.

The ways to sign in come from the server: Google, Apple, or email and password.

- In the web app opened at the server's own editor address, signing in takes you to the server's sign-in page and back to the same tab.
- In the desktop app, or the web app at any other address, your browser opens a sign-in page with a code. Check that it matches the code OpenPencil shows, approve it, and the app picks up the sign-in by itself.

Servers that review new accounts say so before you sign up. Until an administrator approves you, Settings shows that your account is waiting.

Each server in **Settings → OpenPencil Cloud** shows who is signed in to it:

- **Sign-in expired** keeps your account, so **Sign in** goes back to the same one.
- **Account and security** in the server's **…** menu opens the server's own account page, where you change your password, two-step sign-in, and passkeys.
- **Sign out** ends the session on the server. If the server can't be reached, you stay signed in so you can try again.
- **Remove from this app** forgets the server on this device. It warns you when documents still have changes that haven't reached the server, because removing it discards them.

The desktop app keeps its sign-in in the system credential store. In the browser, a sign-in through the server's page lasts as long as the server's session; a sign-in with a code follows **Settings → General → Remember API keys on this device**.

## Find Documents on Home

Home lists places in a sidebar: **Recent**, the workspaces of the server Home shows, **Shared with you**, and your storage bucket. On a phone the same places are in a menu above the documents. With more than one server connected, choose which one Home shows with **Show on Home** in Settings.

A workspace lists its documents with where each one stands, how much of the workspace's storage they use, and your role in it. **New design** creates a document in the workspace you are looking at, unless you can only view it. **Shared with you** lists documents people invited you to in workspaces you are not a member of.

## Save a Document to Cloud

Open or create a document, then choose **File → Save to Cloud…**. Name it and pick a workspace; workspaces where you can only view are listed but can't be chosen. The Cloud copy opens in the same tab and saves as you work. A file you had open on your device keeps its last saved contents.

Saving can fail when the file is over the size the workspace allows, when the workspace is out of space, or when you are offline. Nothing changes on your device in those cases.

## Where a Document Stands

A Cloud document shows its state beside its name. Select it to see the workspace and server, and what you can do next.

| State                      | What it means                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Saved to** _workspace_   | The server has your latest changes.                                                                                           |
| **Saving…**                | Your changes are uploading.                                                                                                   |
| **Saved on this device**   | Your changes are kept here and upload in a moment, or once you are back online.                                               |
| **Changed in two places**  | Someone saved a newer version while you had changes the server didn't have.                                                   |
| **Couldn't save to Cloud** | The server refused the upload. Your changes are safe on this device; **Try again**, or sign in again if your sign-in expired. |
| **View only**              | You can look and follow others, but your changes never reach the document.                                                    |

## When a Document Changed in Two Places

This happens when you edited a document offline, or before you joined a session, while someone else saved a newer version. Nothing is lost until you choose. Select the status beside the name, then **Choose a version**:

- **Keep both** leaves the newer version as it is and saves yours next to it as "(your copy)"; the tab moves to your copy.
- **Use the Cloud version** discards the changes on this device and shows the newer version.
- **Replace it with your version** uploads yours over the newer one for everyone.

**Decide later** keeps both versions until you come back to it.

## Share a Document

Select **Share** on a Cloud document.

- Invite people by email with **Can edit** or **Can view**. They get an email with a link, and the invitation expires after seven days. Change someone's access or remove it from the list.
- Everyone in the document's workspace has the access the workspace gives them.
- Under **General access**, **Anyone with the link** lets people open the document without an account, with **Can view** or **Can edit**. Some workspaces' plans turn links off, and the dialog says so.

The server keeps only a fingerprint of each link, so a link can be copied only on the device that created it. On other devices, **Reset link** makes a new one you can copy; the old link stops working.

## Open an Invitation

An invitation link opens OpenPencil with who invited you, to which document, and on which server. If you have never used that server, OpenPencil warns you to sign in only if you trust it. Sign in with the address the invitation was sent to; if you are signed in as someone else, choose **Use another account**. Once you accept, the document opens and stays under **Shared with you** on Home.

Invitation and share links open in the browser. If you use the desktop app, choose **Open in the desktop app** in the invitation, or on the notice that appears after a shared document opens; your browser asks before it switches to the app.

## Edit Together

Opening a Cloud document joins its live session: everyone who has it open sees each other's cursors and edits as they happen, and can start a voice call from the avatars. One person's app saves the document for everyone, so editing together never makes your changes conflict with someone else's.

People who open a link without an account join under the name OpenPencil gives them, or the one they chose. They edit when the link allows it, but their app never saves to the server; someone signed in who can edit saves for them.
