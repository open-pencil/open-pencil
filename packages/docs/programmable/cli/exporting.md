---
title: Exporting
description: Export document content to images, PDF, PowerPoint, `.fig`, JSX, or HTML, with font-substitution policies for raster and PDF output.
---

# Exporting

Export designs from the terminal — raster images, vectors, PDF, editable PowerPoint, `.fig` subsets, JSX code, or HTML.

## Image Export

```sh
openpencil export design.fig                           # PNG (default)
openpencil export design.fig -f jpg -s 2 -q 90        # JPG at 2×, quality 90
openpencil export design.fig -f webp -s 3             # WEBP at 3×
openpencil export design.fig -f svg                   # SVG vector
openpencil export design.fig -f pdf                   # PDF
openpencil export design.fig -f pptx                  # editable PowerPoint
openpencil export design.fig -f fig --page "Page 1"   # export one page as .fig
openpencil export design.fig -f fig --node 1:23        # export one node as .fig
openpencil export design.fig -f html --css tailwind    # export an HTML fragment with Tailwind classes
```

Options:

- `-f` — format: `png`, `jpg`, `webp`, `svg`, `pdf`, `pptx`, `jsx`, `html`, `fig`
- `-s` — export scale (default: `1`)
- `-q` — quality: `0`–`100` (JPG/WEBP only)
- `-o` — output path
- `--page` — page name
- `--node` — specific node ID

## Font Substitution Policy

For file-backed PNG, JPG, WEBP, and PDF exports, choose how missing or substituted fonts are handled:

```sh
openpencil export design.fig -f pdf --font-policy strict
openpencil export design.fig -f png --font-policy warn
openpencil export design.fig -f webp --font-policy allow
```

- `warn` (default) — report substitutions and continue exporting.
- `strict` — stop with a nonzero exit status if font preparation cannot faithfully resolve the requested faces.
- `allow` — export without the additional font-fidelity check.

Run [`openpencil fonts`](./inspecting#font-diagnostics) first to inspect affected faces. Export preparation may use configured font providers, so its result can differ from the offline file diagnostic.

This policy does not apply to exports from the running app, or to SVG, PowerPoint, JSX, HTML, and `.fig` output. It checks font resolution, not complete visual equivalence with Figma.

## JSX Export

Export as JSX with Tailwind utility classes:

```sh
openpencil export design.fig -f tailwind-jsx    # or: -f jsx --style tailwind
```

Output:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Also supports `--style openpencil` for the native JSX format (see [JSX Renderer](../jsx-renderer)).

## HTML Export

Export as an HTML fragment with inline styles by default, or Tailwind utility classes:

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
```

Use `--html standalone` for a browser-openable HTML document with reset styles and a page wrapper. Standalone HTML is intended as a useful visual/code handoff, not a pixel-perfect renderer replacement:

```sh
openpencil export design.fig -f html --html standalone --css inline
openpencil export design.fig -f html --html standalone --css tailwind
openpencil export design.fig -f html --html standalone --css tailwind --assets external
```

Standalone Tailwind output is compiled during export; it does not depend on the Tailwind browser runtime. Use `--assets external` to write CSS and extracted image assets next to the HTML file. Use `--fonts assets` with external assets to resolve detected SceneGraph text fonts through OpenPencil's configured web-font providers and emit local `@font-face` files.

HTML export is available in file mode.

## Live App Mode

Omit the file to export from the running app:

```sh
openpencil export -f png    # export from the current document
```

Live app mode supports PNG, JPG, WEBP, SVG, and PDF. PowerPoint, JSX, HTML, and `.fig` exports require a file argument. File-mode thumbnail export is not currently supported.
