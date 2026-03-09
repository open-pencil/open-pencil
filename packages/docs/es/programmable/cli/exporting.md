---
title: Exportar
description: Renderiza archivos .fig a PNG, JPG, WEBP, SVG o JSX con clases Tailwind.
---

# Exportar

Exporta diseños desde la terminal — imágenes rasterizadas, vectores o código JSX.

## Exportar Imágenes

```sh
open-pencil export design.fig                          # PNG (predeterminado)
open-pencil export design.fig -f jpg -s 2 -q 90       # JPG a 2×, calidad 90
open-pencil export design.fig -f webp -s 3             # WEBP a 3×
open-pencil export design.fig -f svg                   # SVG vectorial
```

Opciones:

- `-f` — formato: `png`, `jpg`, `webp`, `svg`, `jsx`
- `-s` — escala: `1`–`4`
- `-q` — calidad: `0`–`100` (solo JPG/WEBP)
- `-o` — ruta de salida
- `--page` — nombre de página
- `--node` — ID de nodo específico

## Exportar JSX

Exporta como JSX con clases de utilidad Tailwind:

```sh
open-pencil export design.fig -f jsx --style tailwind
```

Salida:

```html
<div className="flex flex-col gap-4 p-6 bg-white rounded-xl">
  <p className="text-2xl font-bold text-[#1D1B20]">Card Title</p>
  <p className="text-sm text-[#49454F]">Description text</p>
</div>
```

También soporta `--style openpencil` para el formato JSX nativo (ver [Renderizador JSX](../jsx-renderer)).

## Miniaturas

```sh
open-pencil export design.fig --thumbnail --width 1920 --height 1080
```

## Modo Aplicación en Vivo

Omite el archivo para exportar desde la aplicación en ejecución:

```sh
open-pencil export -f png    # captura de pantalla del lienzo actual
```
