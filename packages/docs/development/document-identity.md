---
title: Document identity
description: How layers, variables, and collections get IDs, and which of them a saved .fig file keeps.
---

# Document identity

IDs follow Figma's `sessionID:localID` GUIDs, and both halves stay at or below 2^31 − 1 because Figma reads them as signed 32-bit integers and drops records beyond that.

## New IDs

Every process picks a random session at startup, outside sessions 0 and 1, which FIG keeps for document records and counter GUIDs. IDs count up within it, so the editor, the CLI, and MCP never mint the same ID for different layers, whether they share a room or edit copies of one file. Tests and fixtures that need the same IDs on every run call `setIdSession` with a fixed session, or pass a generator to `new SceneGraph()`.

## Imported layers

Reading a `.fig` file creates each layer under the GUID its record was saved with, and the document root under the ID OpenPencil saved it with, so a layer has the same ID in every process that opens the file and after every save and reopen. `openpencil tree` prints an ID that a later `openpencil node` or `diff apply` finds, and a Cloud room matches the layers of a tab that reopened the stored file. The saved GUID is also the layer's `source.id`.

Layers inside instances have no records of their own and get IDs from a counter, `0:1`, `0:2`, and so on, in the order the reader builds them. The counter skips every GUID in the archive, including records on pages not loaded yet, so a page loaded later still finds its GUIDs free. The same file gets the same counter IDs on every run; pages loaded later continue the counter, and a resumed session carries it in its checkpoint. A record whose GUID another layer already has, such as a repeated record, takes a counter ID too.

## Saving

Figma saves the root as the document record, always `0:0`, so OpenPencil keeps the root's ID in the document record's plugin data; a file saved elsewhere opens with `0:0` as its root. A layer read from the file keeps its saved GUID, which is its ID, even when something such as a Cloud room's copy of it has no `source.id`. A new layer is saved under its own ID when that ID has the GUID shape and no other layer keeps it as its `source.id`; a new variable also stays clear of every record in the archive, including records on pages never opened. Otherwise it takes a counter GUID past every GUID in the file. Reopening the file creates the layer under that GUID, so later saves keep it.

## Limits

Random sessions make collisions between separate edits unlikely, not impossible, and nothing reconciles two copies of a file automatically. A shared room stays the authority for its live document; merging offline copies means applying the changes to one of them and sharing the result as a new room.
