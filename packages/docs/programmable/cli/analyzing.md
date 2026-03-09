---
title: Analyzing Designs
description: Audit colors, typography, spacing, and repeated patterns in .fig files.
---

# Analyzing Designs

The `analyze` commands audit an entire design system from the terminal — find inconsistencies, extract the real palette, spot components waiting to be extracted.

## Colors

```sh
open-pencil analyze colors design.fig
```

Finds every color in the file, counts usage, and shows a visual histogram:

```
#1d1b20  ██████████████████████████████ 17155×
#49454f  ██████████████████████████████ 9814×
#ffffff  ██████████████████████████████ 8620×
#6750a4  ██████████████████████████████ 3967×
```

## Typography

```sh
open-pencil analyze typography design.fig
```

Lists every font family, size, and weight combination with usage counts. Useful for spotting one-off text styles that should be consolidated.

## Spacing

```sh
open-pencil analyze spacing design.fig
```

Audits gap and padding values across auto-layout frames. Helps identify spacing scale inconsistencies — e.g. a stray `13px` gap among otherwise `8/16/24` values.

## Clusters

```sh
open-pencil analyze clusters design.fig
```

Finds repeated node patterns that could be extracted into components:

```
3771× frame "container" (100% match)
     size: 40×40, structure: Frame > [Frame]

2982× instance "Checkboxes" (100% match)
     size: 48×48, structure: Instance > [Frame]
```

## JSON Output

All analyze commands support `--json` for machine-readable output:

```sh
open-pencil analyze colors design.fig --json
```

Pipe into `jq`, feed into CI checks, or use in scripts that enforce design token budgets.
