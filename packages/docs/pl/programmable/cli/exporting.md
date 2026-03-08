---
title: Eksportowanie
description: Renderuj pliki .fig do PNG, JPG, WEBP, SVG lub JSX z klasami Tailwind.
---

# Eksportowanie

Eksportuj projekty z terminala — obrazy rastrowe, wektory lub kod JSX.

## Eksport obrazów

```sh
open-pencil export design.fig                          # PNG (domyślnie)
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG w 2×, jakość 90
open-pencil export design.fig -f webp -s 3             # WEBP w 3×
open-pencil export design.fig -f svg                   # SVG wektor
```

Opcje:

- `-f` — format: `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — skala: `1`–`4`
- `-q` — jakość: `0`–`100` (tylko JPG/WEBP)
- `-o` — ścieżka wyjściowa
- `--page` — nazwa strony
- `--node` — ID konkretnego węzła

## Eksport JSX

Eksportuj jako JSX z klasami narzędziowymi Tailwind:

```sh
open-pencil export design.fig -f jsx --style tailwind
```

Wynik:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Obsługuje również `--style openpencil` dla natywnego formatu JSX (zobacz [Renderer JSX](../jsx-renderer)).

## Miniatury

```sh
open-pencil export design.fig --thumbnail --width 1920 --height 1080
```

## Tryb żywej aplikacji

Pomiń plik, aby eksportować z uruchomionej aplikacji:

```sh
open-pencil export -f png    # zrzut ekranu bieżącego płótna
```
