---
title: Eksport
description: Eksport zawartości dokumentu do PNG, JPG, WEBP, SVG, .fig, JSX lub HTML i konwersja między formatami.
---

# Eksport

CLI eksportuje projekt do raster images, vector graphics, osobnych dokumentów `.fig`, JSX albo HTML.

## Obrazy i .fig

```sh
openpencil export design.fig                           # PNG domyślnie
openpencil export design.fig -f jpg -s 2 -q 90        # JPG, skala 2×, jakość 90
openpencil export design.fig -f webp -s 3             # WEBP, skala 3×
openpencil export design.fig -f svg                   # SVG
openpencil export design.fig -f fig --page "Page 1"   # Jedna strona w osobnym .fig
openpencil export design.fig -f fig --node 1:23        # Jeden obiekt w osobnym .fig
openpencil export design.fig -f html --css tailwind    # Fragment HTML z klasami Tailwind
```

Opcje:

- `-f` — format: `png`, `jpg`, `webp`, `svg`, `jsx`, `html` albo `fig`;
- `-s` — skala od `1` do `4`;
- `-q` — jakość od `0` do `100`, tylko dla JPG i WEBP;
- `-o` — ścieżka pliku wynikowego;
- `--page` — nazwa strony;
- `--node` — ID obiektu.

## JSX

Aby otrzymać JSX z utility classes Tailwind:

```sh
openpencil export design.fig -f jsx --style tailwind
```

Przykład wyniku:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

Opcja `--style openpencil` wybiera własny format JSX OpenPencil. Więcej informacji znajduje się na stronie [JSX renderer](../jsx-renderer).

## HTML

Domyślnie polecenie tworzy fragment HTML z inline styles. Zamiast nich można użyć utility classes Tailwind:

```sh
openpencil export design.fig -f html
openpencil export design.fig -f html --css tailwind
```

Opcja `--html standalone` tworzy pełny dokument HTML, który można otworzyć w przeglądarce. Zawiera reset styles i wrapper strony. Format jest przeznaczony do przekazywania projektu i kodu, a nie do pełnego pixel-perfect odtworzenia renderer:

```sh
openpencil export design.fig -f html --html standalone --css inline
openpencil export design.fig -f html --html standalone --css tailwind
openpencil export design.fig -f html --html standalone --css tailwind --assets external
```

Podczas standalone export Tailwind CSS jest od razu kompilowany, więc browser runtime Tailwind nie jest potrzebny. `--assets external` zapisuje CSS i wyodrębnione obrazy obok HTML. W połączeniu z tą opcją `--fonts assets` wyszukuje fonts obiektów tekstowych SceneGraph przez skonfigurowanych web font providers i tworzy lokalne pliki `@font-face`.

Eksport HTML jest dostępny podczas pracy z plikiem.

## Thumbnail

```sh
openpencil export design.fig --thumbnail --width 1920 --height 1080
```

## Eksport z uruchomionej aplikacji

Nie podawaj pliku, aby eksportować bieżący dokument z aplikacji:

```sh
openpencil export -f png    # Zrzut bieżącego obszaru roboczego
```
