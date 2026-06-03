---
title: Inspecting Files
description: Browse node trees, search by name or type, and dig into properties from the terminal.
---

# Inspecting Files

The CLI lets you explore design documents without opening the editor. Every command also works on the live app — just omit the file argument.

::: tip Install
```sh
npm install -g @inkly/cli
# or
brew install inkly/tap/inkly
```
:::

## Document Info

Get a quick overview — page count, total nodes, fonts used, file size:

```sh
inkly info design.fig
```

## Node Tree

Print the full node hierarchy:

```sh
inkly tree design.fig
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
inkly find design.fig --type TEXT
```

Search by name:

```sh
inkly find design.fig --name "Button"
```

Both flags can be combined to narrow results further.

## Query with XPath

Use XPath selectors to find nodes by type, attributes, and tree structure:

```sh
inkly query design.fig "//FRAME"
```

### Useful patterns

**By type:**

```sh
inkly query design.fig "//TEXT"                    # All text nodes
inkly query design.fig "//COMPONENT"               # All components
inkly query design.fig "//INSTANCE"                # All instances
```

**By attributes:**

```sh
inkly query design.fig "//FRAME[@width < 300]"                # Frames under 300px wide
inkly query design.fig "//*[@cornerRadius > 0]"               # Rounded corners
inkly query design.fig "//*[@visible = false]"                # Hidden nodes
inkly query design.fig "//TEXT[@fontSize >= 24]"              # Large text
inkly query design.fig "//*[@opacity < 1]"                    # Semi-transparent nodes
```

**By name and text content:**

```sh
inkly query design.fig "//TEXT[contains(@name, 'Button')]"    # Name contains 'Button'
inkly query design.fig "//TEXT[contains(@text, 'Hello')]"     # Text content contains 'Hello'
```

**By hierarchy:**

```sh
inkly query design.fig "//SECTION//TEXT"            # Text inside sections
inkly query design.fig "//FRAME/TEXT"               # Direct text children of frames
inkly query design.fig "//COMPONENT_SET//INSTANCE"  # Instances inside component sets
```

### Queryable attributes

`name`, `width`, `height`, `x`, `y`, `visible`, `opacity`, `cornerRadius`, `fontSize`, `fontFamily`, `fontWeight`, `layoutMode`, `itemSpacing`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `strokeWeight`, `rotation`, `locked`, `blendMode`, `text`, `lineHeight`, `letterSpacing`

### Example output

```
  Found 5 nodes

[0] [frame] "Logo  92×32" (0:9)
[1] [frame] "logo-short-6  31×32" (0:10)
[2] [frame] "wrapper  128×73" (0:20)
[3] [frame] "pen-drawing  148×52" (0:21)
[4] [frame] "surprised-emoji  32×32" (0:26)
```

## Node Details

Inspect all properties of a specific node by its ID:

```sh
inkly node design.fig --id 1:23
```

## Pages

List all pages in the document:

```sh
inkly pages design.fig
```

## Variables

List design variables and their collections:

```sh
inkly variables design.fig
```

## Live App Mode

When the desktop app is running, omit the file argument — the CLI connects via RPC and operates on the live canvas:

```sh
inkly tree              # inspect the live document
inkly eval -c "..."     # query the editor
```

## Lint Designs

Check documents for naming, layout, structure, and accessibility issues:

```sh
inkly lint design.fig
inkly lint design.pen --preset strict
inkly lint design.fig --rule color-contrast
inkly lint design.fig --list-rules
```

Use `--json` for machine-readable output.

## JSON Output

All commands support `--json` for machine-readable output — pipe into `jq`, feed to CI scripts, or process with other tools:

```sh
inkly tree design.fig --json | jq '.[] | .name'
```
