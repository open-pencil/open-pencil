---
title: Sharing and Teams
description: Share OpenPencil Cloud documents by invitation or link, work in team workspaces, edit together, and report a shared document.
---

# Sharing and Teams

## Share a Document

Select **Share** on a Cloud document.

- Invite people by email with **Can edit** or **Can view**. They get an email with a link, and the invitation expires after seven days. Change someone's access or remove it from the list.
- Everyone in the document's workspace has the access the workspace gives them.
- Under **General access**, **Anyone with the link** lets people open the document with **Can view** or **Can edit**. Where the server allows it, they need no account; otherwise they sign in to the server first, and the dialog says which. Some workspaces' plans turn links off, and the dialog says so too.

The server keeps only a fingerprint of each link, so a link can be copied only on the device that created it. On other devices, **Reset link** makes a new one you can copy; the old link stops working.

## Open an Invitation

An invitation link opens OpenPencil with who invited you, to which document, and on which server. If you have never used that server, OpenPencil warns you to sign in only if you trust it. Sign in with the address the invitation was sent to; if you are signed in as someone else, choose **Use another account**. Once you accept, the document opens and stays under **Shared with you** on Home.

Invitation and share links open in the browser. If you use the desktop app, choose **Open in the desktop app** in the invitation, or on the notice that appears after a shared document opens; your browser asks before it switches to the app.

## Work in a Team Workspace

Every account starts with a workspace of its own. To work with a team, select **+** beside **OpenPencil Cloud** in Home's sidebar, name the workspace, and you administer it. **Members** in the workspace's header has three tabs:

- **Members** lists who is in the workspace and when each person joined. Admins invite people by email as an admin, editor, or viewer, change roles, and remove people. Editors and admins change documents; viewers only look.
- **Invited**, for admins, lists invitations nobody has accepted yet, with who sent each one and when it expires. An invitation arrives by email; if the server doesn't send email, copy the invitation link from the dialog and pass it on. Invitations expire after seven days. **Resend** sends one again with a new link, and the earlier link stops working; so does inviting the same address again.
- **Settings** renames the workspace, and holds leaving and deleting it. Anyone can leave a workspace, except its last admin: make someone else an admin first. Admins can delete a workspace once it holds no documents. Deleted documents wait in Trash, and the workspace can be deleted once the server has removed them: at the end of their time in Trash, or, for one deleted forever, once its grace period has passed (7 days unless the server's administrators set another).

Opening a workspace invitation works like a document invitation: sign in with the invited address, choose **Join workspace**, and Home shows the workspace.

## Edit Together

Opening a Cloud document joins its live session: everyone who has it open sees each other's cursors and edits as they happen. One person's app saves the document for everyone, so editing together never makes your changes conflict with someone else's.

People who open a link without an account, where the server allows it, join under the name OpenPencil gives them, or the one they chose. They edit when the link allows it, but their app never saves to the server; someone signed in who can edit saves for them. Until such a person opens the document, the live session keeps the guests' edits, and the saved document and its version history catch up once they do.

## Report a Shared Document

A document opened from a share link has a flag button, **Report this file**, beside the menu at the top of the window. Choose what's wrong (spam or phishing, illegal content, copyright, harassment, or something else), add details, and, if you want an answer, your email: on a server that sends email, which the hosted service does, you then get a confirmation that the report arrived, and later what the administrators decided. Only the server's administrators see the report. They can dismiss it, or block the document so nobody can open it, its owner included, until they restore it. On a server that sends email, the owner of the document's workspace gets an email when it's blocked, with the reason the administrators gave and where to contest it, and another when it's restored. On the hosted service you can also write to [abuse@openpencil.dev](mailto:abuse@openpencil.dev).
