---
title: Cloud Documents
description: Save documents to OpenPencil Cloud, find them on Home, follow their state, resolve conflicts, browse version history, and restore them from Trash.
---

# Documents

## Save a Document to Cloud

Open or create a document, then choose **File → Save to…**. When there is only one place it can go, it is saved there under its current name; with several workspaces, or a storage bucket too, pick one, and the last place you used is chosen first. Workspaces where you can only view are listed but can't be chosen. The Cloud copy opens in the same tab and saves as you work. A file you had open on your device keeps its last saved contents.

Saving can fail when the file is over the size the workspace allows, when the workspace is out of space, or when you are offline. Nothing changes on your device in those cases.

## Find Documents on Home

Home lists places in a sidebar: **Recent**, the workspaces of the server Home shows, **Shared with you**, **Trash**, and your storage bucket. On a phone the same places are in a menu above the documents. With more than one server connected, choose which one Home shows with **Show on Home** in Settings. At the server's own editor address, OpenPencil opens on Home, in your first workspace until you pick another place.

A workspace lists its documents with where each one stands, how much of the workspace's storage they use, and your role in it. Every account starts with a workspace of its own. **New design** creates a document in the workspace you are looking at, and says which one; in **Shared with you** it creates in your own workspace, and in Recent, or a workspace you can only view, it creates a file on your device. **Shared with you** lists documents people invited you to in workspaces you are not a member of.

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

## Restore a Deleted Document

Deleting a document in a workspace moves it to **Trash** for everyone who can open it. **Trash** in Home's sidebar lists the documents deleted from your workspaces, with the workspace each came from, when it was deleted and by whom, and how many days it has left; the server deletes it for good after that, 30 days unless its administrators set another period. **Restore** puts it back in its workspace with its version history. Anyone who could delete a document can restore it. Its owner and the workspace's admins can also select **Delete forever**: it leaves Trash and stops counting toward the workspace's storage at once, and can't be undone. The server removes it within a few days, 7 unless its administrators set another period, and until then only a server administrator can bring it back. A document in Trash still counts toward the workspace's storage until it is deleted forever or its time runs out.
