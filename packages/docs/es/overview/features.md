# Características

## Archivos de Figma

OpenPencil abre y guarda archivos `.fig` directamente. La importación y exportación usan el mismo códec binario Kiwi que Figma: 194 definiciones de esquema y unos 390 campos por objeto. Guardar: <kbd>⌘</kbd><kbd>S</kbd>. Guardar como: <kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>.

**Copiar y pegar con Figma:** selecciona objetos en Figma, pulsa <kbd>⌘</kbd><kbd>C</kbd>, cambia a OpenPencil y usa <kbd>⌘</kbd><kbd>V</kbd>. Los rellenos, contornos, la disposición automática, el texto, los efectos, los radios de esquina y las redes vectoriales se conservan en ambas direcciones.

## Dibujo y edición

- **Formas:** rectángulo (<kbd>R</kbd>), elipse (<kbd>O</kbd>), línea (<kbd>L</kbd>), polígono y estrella.
- **Pluma:** redes vectoriales, curvas de Bézier y tiradores tangentes.
- **Texto:** edición directa en el lienzo y soporte de IME.
- **Texto enriquecido:** negrita, cursiva, subrayado y tachado en rangos de caracteres.
- **Disposición automática:** Flexbox y CSS Grid mediante Yoga WASM, con dirección, separación, relleno, distribución, alineación, tamaño y pistas de cuadrícula.
- **Componentes:** creación de componentes y conjuntos, instancias, sustituciones y sincronización.
- **Variables:** valores de diseño con colecciones, modos claro/oscuro, tipos color/número/texto/booleano y enlaces.
- **Secciones:** contenedores de organización que incorporan automáticamente los objetos superpuestos.

## Panel de propiedades

Las pestañas Diseño, Código e AI se adaptan a la selección:

- **Apariencia:** opacidad, radio uniforme o por esquina y visibilidad.
- **Relleno:** color sólido, degradados lineal, radial, angular y diamante, e imágenes.
- **Contorno:** color, grosor, alineación, grosor por lado, extremos, uniones y guiones.
- **Efectos:** sombra exterior e interior, desenfoque de capa, fondo y primer plano.
- **Tipografía:** selector de fuentes con búsqueda y desplazamiento virtual, estilo, tamaño, alineación y formato.
- **Disposición:** controles de la disposición automática.
- **Exportación:** escala, PNG/JPG/WEBP/SVG y vista previa.

## Renderizado

OpenPencil usa Skia mediante CanvasKit WASM, el mismo motor gráfico de Figma:

- degradados lineales, radiales, angulares y diamante;
- rellenos de imagen con varios modos de escala;
- caché de efectos por objeto;
- arcos, elipses parciales y anillos;
- exclusión de objetos fuera de la vista y reutilización de herramientas de pintura;
- guías de ajuste que tienen en cuenta la rotación;
- reglas con el rango de la selección;
- resaltado que sigue la geometría real.

## Deshacer y rehacer

La creación, eliminación, movimiento, cambio de tamaño, propiedades y jerarquía, disposición y variables se pueden deshacer. Atajos: <kbd>⌘</kbd><kbd>Z</kbd> y <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd>.

## Páginas y documentos

Puedes crear, eliminar y renombrar páginas; cada una conserva su posición y escala de vista. Se pueden abrir varios documentos en pestañas.

## Exportación

- **Imágenes:** PNG, JPG y WEBP con escala de 0,5× a 4×.
- **SVG:** formas, texto con rangos de estilo, degradados, efectos y modos de fusión.
- **Tailwind JSX:** HTML con clases Tailwind v4 para React o Vue.
- **Copiar como:** texto, SVG, PNG o JSX desde el menú contextual.

```sh
openpencil export design.fig -f jsx --style tailwind
```

## Chat con AI

<kbd>⌘</kbd><kbd>J</kbd> abre el asistente. Más de 90 herramientas crean formas, modifican estilos y disposiciones, trabajan con componentes y variables, ejecutan operaciones booleanas, analizan variables de diseño y exportan recursos. Admite Anthropic, OpenAI, Google AI, OpenRouter y extremos compatibles.

Las llamadas a herramientas aparecen en una cronología plegable. Para verificar visualmente los cambios, el asistente renderiza el resultado y lo compara con la solicitud. Todas las modificaciones realizadas por AI se pueden deshacer.

## Servidor MCP

Claude Code, Cursor, Windsurf y otros clientes MCP pueden leer y modificar archivos `.fig` con más de 90 herramientas. Están disponibles stdio y HTTP.

```sh
npm install -g @open-pencil/mcp
```

## CLI

La CLI examina, exporta y analiza archivos `.fig`:

```sh
openpencil tree design.fig              # Árbol del documento
openpencil find design.fig --type TEXT  # Búsqueda
openpencil export design.fig -f png     # Exportación
openpencil analyze colors design.fig    # Análisis de colores
openpencil analyze clusters design.fig  # Estructuras repetidas
openpencil eval design.fig -c "..."     # Figma Plugin API
```

Todos los comandos admiten `--json`. Instalación: `npm install -g @open-pencil/cli` o `bun add -g @open-pencil/cli`.

## Colaboración en tiempo real

La colaboración funciona directamente entre participantes mediante WebRTC y no necesita servidor central. Basta con compartir un enlace. Incluye cursores, presencia y seguimiento de la vista de otro participante.

## Escritorio y web

**Escritorio:** Tauri v2, unos 7 MB, para macOS, Windows y Linux, con menús nativos, uso sin conexión y guardado automático.

**Web:** [app.openpencil.dev](https://app.openpencil.dev), instalable como PWA y adaptado a pantallas táctiles.

## Carga alternativa desde Google Fonts

Si una fuente no está disponible localmente, OpenPencil la descarga automáticamente desde Google Fonts. No hace falta instalarla manualmente.
