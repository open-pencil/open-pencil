---
title: Document identity and review snapshots
description: Numeric GUID allocation, canonical review serialization, and offline collaboration boundaries.
---

# Document identity and review snapshots

This is a proposed implementation contract for [#770](https://github.com/open-pencil/open-pencil/issues/770), building on the allocation and collaboration fixes in #887, #902, and #915 and the saved-GUID fix in #973 (which closes #890). It addresses the remaining headless collision path and defines deterministic review serialization. The numeric GUID policy, review artifact API, and offline handoff remain proposals for maintainer review; this does not select a new editable file format.

## Identity: random numeric GUIDs

Production allocation uses two independently random unsigned 32-bit numbers, written as `sessionID:localID`, for each new entity. Sessions 0 and 1 are excluded from random allocation because FIG uses them for document and internal-resource records. The resulting namespace is nearly 64 bits. This applies to the browser, desktop, CLI, and headless SDK; allocation is no longer tied to a process-local counter or a window's random 32-bit session.

Numeric GUIDs fit the existing Kiwi fields directly. UUIDs offer a larger collision margin but require a durable UUID-to-GUID mapping for every save, reference and imported resource. This implementation chooses numeric compatibility rather than adding that second identity system. Random allocation reduces collision risk; it is not a uniqueness guarantee. A graph still skips generated IDs already in its entity tables. Saved archive record identities, including unopened pages, are reserved when exporting new layers.

Existing saved identities are preserved. FIG imports keep reproducible, sequential runtime handles for inspection and patches, with saved GUIDs in `source.id`; new edits on an imported graph use random allocation. Runtime handles are not document identity and must not be used to match two independently authored files. New layers keep their numeric GUIDs through both full exports and archive patch exports. Legacy/non-numeric or colliding runtime IDs use the existing export fallback; already-colliding offline branches still need explicit reconciliation.

`SceneGraph` accepts an injected generator for reproducible authoring and fixtures. `setIdSession(n)` explicitly opts into the legacy sequential scheme, and `setIdSession()` restores random allocation. Callers that opt into deterministic allocation must retain authoring identities or scope their namespace themselves: regeneration does not infer which new node is an old one.

## Serialization: a review artifact first

```sh
openpencil diff snapshot design.fig -o design.review.json
openpencil diff snapshot design.fig > design.review.json
```

The version 1 artifact decodes every FIG record, including unopened pages, without materializing the graph or loading CanvasKit. Records are keyed by their saved GUID, so runtime allocation has no effect on the bytes. It includes decoded record fields, indexed blobs, and embedded images. It excludes archive metadata, timestamps, thumbnails, compression and ZIP headers. Ordinary FIG saving retains those features.

The serialization rules are:

- Records, image names, and object keys sort by UTF-16 code-unit comparison, independent of locale and insertion order. Each record occupies one line so a property edit produces a narrow diff.
- All arrays retain order, including indexed blobs, paints, component properties, and text runs. Blob indices are references, so sorting blobs without rewriting references would change the document.
- Bytes are standard padded Base64. Numbers use ECMAScript JSON number formatting, with negative zero represented as zero, no rounding of other finite values, and non-finite values rejected.
- Undefined object properties are omitted. Non-JSON values, cycles, duplicate saved record GUIDs and duplicate image names are rejected.
- The output has LF line endings and one final newline. The format marker and version distinguish it from an editable document.

Equal represented record/resource state produces equal bytes despite key, record, or image insertion order and archive presentation metadata. This is a structural review projection, not a claim that every visually equivalent file has identical bytes: indexed blob renumbering, font shaping and different retained records remain observable. It is not a lossless archive backup and has no loader. Existing `diff files`, JSX patches and visual diffs remain complementary; snapshots do not provide a semantic merge driver.

Choosing review artifacts first makes saved identity and raw-field changes inspectable without committing to an editable text schema. A git-native format would additionally need a validated loader, asset storage policy, reference validation, migration/versioning and an explicit merge operation. `.pen` remains a separate format decision under [#767](https://github.com/open-pencil/open-pencil/issues/767).

Existing `diff files` compares materialized trees by page name and node name path; this projection instead compares every saved record by GUID, including raw fields and unopened pages. Core's `canonicalJSONString` serves library hashing, represents bytes as `$bytes` arrays, and follows ordinary JSON handling of non-finite numbers and unsupported values. The review serializer uses Base64, rejects ambiguous or unsupported data, and writes object keys directly in code-unit order, including integer-like keys. It belongs in FIG so it can decode archives without depending on Core; sharing the hashing helper directly would reverse that package dependency.

## Merge authority: a room owns its live revision

Yjs and the layer-tree CRDT remain authoritative while editing a room. Git may version an offline FIG and its generated review artifact, but merging the review JSON does not modify either the FIG or a room. An offline resolution is a new document revision, not a Yjs update.

The proposed reconciliation boundary is manual and explicit:

1. Save the room's agreed state as the offline base and retain it alongside branch exports. Review both branch artifacts against that base; preserve saved identities and resolve competing edits intentionally.
2. Apply the chosen edits to an offline document through editor or CLI operations. Reopen and inspect the result, checking parent/child membership, order, cycles, component and variable references, and asset availability. A syntactically clean git merge is insufficient evidence.
3. Share the resolved document as a new room. Keep the old room as the old revision; do not inject the resolution's whole graph or review JSON into an active room. Joining a room opens its own document tab.

There is no automatic offline-to-room reconciler in this change. Such a feature must carry a base revision, detect intervening room edits, validate the resolved hierarchy and references, and require an explicit authority transfer before starting a new room revision. Until that protocol exists, a fresh room keeps the two merge authorities from competing.

## Verification and adoption limits

Regression coverage checks independent branch additions through archive save/reopen, retained GUIDs and lazy-page review coverage, deterministic CLI output across processes, unordered collection/key normalization, ordered arrays, resources, and rejection of ambiguous identities. Compatibility tests exercise existing CLI patches and archived import/export behavior.

The projection describes saved records, not unsaved canvas state. Ordinary FIG output is still nondeterministic, raw blobs may produce broad diff lines, and live-Figma round-trip acceptance remains a separate check. This proposal supplies allocation and review behavior for evaluation; a git-native editor format and automatic offline reconciliation remain separate product work, and #770 remains open pending acceptance of the policy decisions.
