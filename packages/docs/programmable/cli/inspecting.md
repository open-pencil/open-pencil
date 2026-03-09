---
title: Inspecting Files
description: Browse node trees, search by name or type, and dig into properties from the terminal.
---

# Inspecting Files

The CLI lets you explore `.fig` files without opening the editor. Every command also works on the live app — just omit the file argument.

::: tip Install
```sh
bun add -g @open-pencil/cli
# or
brew install open-pencil/tap/open-pencil
```
:::

## Document Info

Get a quick overview — page count, total nodes, fonts used, file size:

```sh
open-pencil info design.fig
```

## Node Tree

Print the full node hierarchy:

```sh
open-pencil tree design.fig
```

```
[0] [page] "Getting started" (0:46566)
  [0] [section] "" (0:46567)
    [0] [frame] "Body" (0:46568)
      [0] [frame] "Introduction" (0:46569)
        [0] [frame] "Introduction Card" (0:46570)
          [0] [frame] "Guidance" (0:46571)
```

## Find Nodes

Search by type:

```sh
open-pencil find design.fig --type TEXT
```

Search by name:

```sh
open-pencil find design.fig --name "Button"
```

Both flags can be combined to narrow results further.

## Node Details

Inspect all properties of a specific node by its ID:

```sh
open-pencil node design.fig --id 1:23
```

## Pages

List all pages in the document:

```sh
open-pencil pages design.fig
```

## Variables

List design variables and their collections:

```sh
open-pencil variables design.fig
```

## Live App Mode

When the desktop app is running, omit the file argument — the CLI connects via RPC and operates on the live canvas:

```sh
open-pencil tree              # inspect the live document
open-pencil eval -c "..."     # query the editor
```

## JSON Output

All commands support `--json` for machine-readable output — pipe into `jq`, feed to CI scripts, or process with other tools:

```sh
open-pencil tree design.fig --json | jq '.[] | .name'
```
