---
title: Comparing Designs
description: Diff nodes and documents structurally and visually, and apply patches.
---

# Comparing Designs

The `diff` commands compare two nodes, preview or apply changes as patches, render pixel diffs, and compare whole documents. Each node command works on a file or, without one, on the document open in the running app.

## Patches

```sh
openpencil diff create design.fig --from 1:23 --to 1:87
```

Prints a patch that turns the first tree into the second. Its properties are the JSX attributes the [JSX export](../jsx-renderer#exporting-to-jsx) writes, so it covers everything the export does. Children match by name, and a reordered child reads as one move:

```diff
@@ /Card #1:23
-rounded={8}
+rounded={12}
@@ /Card/Header #1:24
-bg="#FFFFFF"
+bg="#F4F4F5"
@@ /Card/Badge #1:26 moved to 0
@@ /Card/Note #1:27 removed
@@ /Card/Price added to #1:23 at 3
+<Text name="Price" size={24}>$9</Text>
```

Each hunk names a node by path, for reading, and by ID, which locates it. `-` lines hold the old attribute values and `+` lines the new ones; an added node is its JSX.

`diff show` previews setting attributes on a node without changing it, and prints the patch:

```sh
openpencil diff show 1:24 design.fig --attributes 'bg="#F4F4F5" rounded={8}' > header.diff
```

`diff apply` applies a patch to the document whose IDs it names. Every node must still have the patch's old values unless `--force` skips that check, and nothing changes unless every hunk applies, so a patch never half-applies:

```sh
openpencil diff apply header.diff design.fig --dry-run   # validate first
openpencil diff apply header.diff design.fig --write     # save in place
openpencil diff apply header.diff design.fig -o out.fig  # save elsewhere
```

Updates change only the fields their attributes set, so node IDs, instance links, and state JSX does not describe stay intact. Removed nodes are deleted and added nodes are rendered from their JSX.

## JSX diff

```sh
openpencil diff jsx design.fig --from 1:23 --to 1:87
```

Compares two subtrees as a line diff of their design JSX, for reading rather than applying.

## Visual diff

```sh
openpencil diff visual design.fig --from 1:23 --to 1:87 --output diff.png
```

Renders both nodes at the same scale and writes a PNG with changed pixels in red over a faded copy of the source. The report includes the changed pixel ratio and the changed region in source-node coordinates. `--scale` and `--max-edge` bound the render the same way `export_image` does; `--threshold` sets the color tolerance.

## Comparing documents

```sh
openpencil diff files before.fig after.fig
openpencil diff files before.fig after.fig --page "Mobile" --json
```

Compares two documents page by page. Pages match by name and nodes by name path, so two versions of a file compare even though node IDs differ; the patch applies to the first document. Patches do not add or remove pages: a page only one document has is listed by name and status instead. Like `diff(1)`, the command exits with status 1 when the documents differ.

## Agents

The same operations are available as the `diff_create`, `diff_jsx`, `diff_show`, `diff_apply`, and `diff_visual` tools for the built-in AI chat and MCP clients. `diff_visual` returns its image to the model, so an agent can confirm that an edit touched only the intended region.
