---
title: Scripting
description: Ejecutar JavaScript con una API compatible con plugins de Figma para consultar, modificar y generar diseños.
---

# Scripting

`openpencil eval` ejecuta JavaScript sobre un documento y proporciona un objeto global `figma`. Resulta útil para cambios por lotes, inspección, datos de prueba y automatización sin abrir la interfaz del editor.

## Uso básico

```sh
openpencil eval design.fig -c "return figma.currentPage.children.length"
```

`-c` acepta JavaScript. Si el código no empieza por `return`, OpenPencil lo ejecuta dentro de una función asíncrona y devuelve el resultado cuando existe.

```sh
openpencil eval design.fig -c "
  const frame = figma.createFrame()
  frame.name = 'Card'
  frame.resize(300, 200)
  frame.layoutMode = 'VERTICAL'
  frame.itemSpacing = 12
  return { id: frame.id, name: frame.name }
"
```

## Consultar objetos

```sh
openpencil eval design.fig -c "
  return figma.currentPage
    .findAll((node) => node.type === 'FRAME' && node.name.includes('Button'))
    .map((button) => ({ id: button.id, name: button.name }))
"
```

## Modificar y guardar

`--write` o `-w` sobrescribe el archivo de entrada. `--output` o `-o` crea otro.

```sh
openpencil eval design.fig -c "figma.currentPage.name = 'Updated'" -o updated.fig
```

## Leer el script de stdin

```sh
cat transform.js | openpencil eval design.fig --stdin --write
```

## Documento abierto

Omite la ruta para ejecutar el script sobre el documento activo en la aplicación de escritorio:

```sh
openpencil eval -c "return figma.currentPage.name"
```

## Salida

En entornos no interactivos, `eval` usa JSON de forma predeterminada. `--json` lo solicita explícitamente y `--quiet` o `-q` oculta la salida cuando solo se escribe un archivo.

## API compatible

La API sigue el modelo de Figma Plugin API, pero actúa sobre SceneGraph y los formatos de OpenPencil.

### Documento y páginas

- `figma.root`
- `figma.currentPage`
- `figma.currentPage.selection`
- `figma.getNodeById(id)`
- `figma.createPage()`

### Crear objetos

- `figma.createFrame()`
- `figma.createRectangle()`
- `figma.createEllipse()`
- `figma.createText()`
- `figma.createLine()`
- `figma.createPolygon()`
- `figma.createStar()`
- `figma.createVector()`
- `figma.createComponent()`
- `figma.createSection()`

### Operaciones de árbol

`children`, `parent`, `appendChild`, `insertChild`, `clone`, `remove`, `findAll`, `findOne`, `findChild`, `findChildren`, `figma.group` y `figma.ungroup` funcionan como sus equivalentes de Figma.

### Componentes y variables

Se admiten creación de componentes e instancias, consulta del componente principal, colecciones, modos, creación y eliminación de variables y enlaces mediante `bindVariable` y `unbindVariable`.

### Propiedades

Las propiedades habituales se leen y modifican mediante el objeto correspondiente: geometría, apariencia, radios, texto, disposición automática y contornos. Se conservan nombres exactos como `fills`, `fontSize`, `layoutMode` y `strokeWeight`.

### Utilidades

- `figma.mixed`
- `figma.createImage(data)`
- `figma.loadFontAsync(fontName)` — no bloquea la edición de texto;
- `figma.listAvailableFontsAsync()` — devuelve las fuentes del sistema;
- `figma.notify(message)` — escribe un aviso cuando no hay interfaz;
- `figma.viewport`.

## Limitaciones

Aún no hay equivalentes completos para `node.exportAsync()`, `node.setBoundVariable()`, `node.detachInstance()`, `figma.combineAsVariants()`, estilos de pintura/texto y todas las operaciones booleanas vectoriales.

Según la tarea, pueden usarse el comando de exportación, las herramientas del núcleo o las operaciones directas de SceneGraph.
