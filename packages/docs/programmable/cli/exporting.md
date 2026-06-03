---
title: Exporting
description: Export document content to PNG, JPG, WEBP, SVG, `.fig`, or JSX, and convert between document formats.
---

# Exporting

Export designs from the terminal — raster images, vectors, `.fig` subsets, or JSX code.

## Image Export

```sh
inkly export design.fig                           # PNG (default)
inkly export design.fig -f jpg -s 2 -q 90        # JPG at 2×, quality 90
inkly export design.fig -f webp -s 3             # WEBP at 3×
inkly export design.fig -f svg                   # SVG vector
inkly export design.fig -f fig --page "Page 1"   # export one page as .fig
inkly export design.fig -f fig --node 1:23        # export one node as .fig
```

Options:

- `-f` — format: `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — scale: `1`–`4`
- `-q` — quality: `0`–`100` (JPG/WEBP only)
- `-o` — output path
- `--page` — page name
- `--node` — specific node ID

## JSX Export

Export as JSX with Tailwind utility classes:

```sh
inkly export design.fig -f jsx --style tailwind
```

Output:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Also supports `--style inkly` for the native JSX format (see [JSX Renderer](../jsx-renderer)).

## Thumbnails

```sh
inkly export design.fig --thumbnail --width 1920 --height 1080
```

## Live App Mode

Omit the file to export from the running app:

```sh
inkly export -f png    # screenshot the current canvas
```
