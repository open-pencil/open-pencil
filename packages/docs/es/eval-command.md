# `open-pencil eval` — API de Plugin compatible con Figma para scripting headless

## Visión general

`bun open-pencil eval <file> --code '<js>'` ejecuta JavaScript contra un archivo `.fig` con un objeto global `figma` compatible con Figma. Esto permite scripting headless, operaciones por lotes, ejecución de herramientas IA y pruebas — todo sin interfaz gráfica.

El objeto `figma` refleja la superficie de la API de Plugin de Figma lo más fielmente posible, por lo que el conocimiento existente sobre plugins de Figma y los fragmentos de código son directamente transferibles.

```bash
# Crear un marco, configurar auto-layout, añadir hijos
bun open-pencil eval design.fig --code '
  const frame = figma.createFrame()
  frame.name = "Card"
  frame.resize(300, 200)
  frame.layoutMode = "VERTICAL"
  frame.itemSpacing = 12
  frame.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }]
  return { id: frame.id, name: frame.name }
'

# Consultar nodos
bun open-pencil eval design.fig --code '
  const buttons = figma.currentPage.findAll(n => n.name.includes("Button"))
  return buttons.map(b => ({ id: b.id, name: b.name }))
'

# Escribir los cambios
bun open-pencil eval design.fig --code '...' --write
```

## Arquitectura

```
CLI: open-pencil eval <file> --code '...'
  → loadDocument(file) → SceneGraph
  → FigmaAPI(sceneGraph) → proxy `figma`
  → AsyncFunction('figma', code)(figmaProxy)
  → imprimir resultado / guardar con --write
```

### Clases principales

| Clase | Ubicación | Rol |
|-------|-----------|-----|
| `FigmaAPI` | `packages/core/src/figma-api.ts` | Objeto proxy que implementa métodos `figma.*` |
| `FigmaNode` | `packages/core/src/figma-api.ts` | Proxy que envuelve `SceneNode` con acceso a propiedades estilo Figma |
| Comando `eval` | `packages/cli/src/commands/eval.ts` | Carga documento, crea API, ejecuta código |

### ¿Por qué en `@open-pencil/core`?

La clase `FigmaAPI` vive en core porque: las herramientas IA la reutilizan, los tests la usan y no tiene dependencias DOM.

## Comando CLI

```
bun open-pencil eval <file> [opciones]

Argumentos:
  file            Archivo .fig sobre el que operar

Opciones:
  --code, -c      Código JavaScript a ejecutar
  --stdin         Leer código desde stdin
  --write, -w     Escribir cambios en el archivo de entrada
  -o, --output    Escribir en un archivo diferente
  --json          Salida como JSON
  --quiet, -q     Suprimir la salida
```

## Implementación por fases

- **Fase 1: Core** — creación de nodos, propiedades, operaciones de árbol, auto-layout, texto (~80% de scripts reales)
- **Fase 2: Componentes e Instancias** — createComponent, createInstance, detachInstance
- **Fase 3: Variables** — getLocalVariables, createVariable, setBoundVariable
- **Fase 4: Estilos y Avanzado** — estilos paint/texto/efectos, operaciones booleanas

[Referencia API completa en inglés](/eval-command)
