# Características

## Por qué OpenPencil

Las herramientas de diseño son un problema de cadena de suministro. Cuando tu herramienta es de código cerrado, el proveedor controla lo que es posible — pueden romper tu automatización de la noche a la mañana. OpenPencil es una alternativa open-source: licencia MIT, compatible con Figma, completamente local y programable.

## Import & export de archivos .fig de Figma

Abre y guarda archivos nativos de Figma directamente. El import decodifica el esquema Kiwi completo de 194 definiciones incluyendo mensajes NodeChange con ~390 campos. El export codifica el grafo de escena de vuelta a binario Kiwi con compresión Zstd y generación de miniatura. Guardar (<kbd>⌘</kbd><kbd>S</kbd>) y Guardar como (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>S</kbd>) usan diálogos nativos del SO en la app de escritorio. El pipeline de import/export soporta fidelidad round-trip.

## Copiar y pegar con Figma

Selecciona nodos en Figma, <kbd>⌘</kbd><kbd>C</kbd>, cambia a OpenPencil, <kbd>⌘</kbd><kbd>V</kbd> — aparecen con rellenos, trazos, auto-layout, texto, radios de esquina, efectos y redes vectoriales preservados. Funciona también en la otra dirección: copia desde OpenPencil, pega en Figma.

Internamente, ambas direcciones usan el mismo formato binario Kiwi que los archivos .fig. OpenPencil decodifica el esquema completo al pegar (194 definiciones, ~390 campos por NodeChange) y lo codifica al copiar. Los datos vectoriales se transportan ida y vuelta a través del formato binario `vectorNetworkBlob`. También funciona entre instancias de OpenPencil via un formato de portapapeles nativo separado.

El pegado gestiona escenarios complejos: las rutas vectoriales se escalan desde `normalizedSize` de Figma a los límites reales del nodo, los hijos de instancia se pueblan desde el `symbolData` de su componente, los conjuntos de componentes se detectan promoviendo frames con `componentPropDefs` de variante, los nodos del canvas interno se omiten, y los `symbolOverrides` se aplican para texto, rellenos, visibilidad y propiedades de layout. Las fuentes referenciadas por nodos de texto pegados se cargan automáticamente.

## Redes vectoriales

La herramienta pluma usa el modelo de red vectorial de Figma — no rutas simples. Clic para puntos de esquina, clic+arrastrar para curvas de Bézier con asas de tangente. Soporta rutas abiertas y cerradas. Los datos vectoriales usan el mismo formato binario `vectorNetworkBlob` que Figma.

## Herramientas de forma

La barra de herramientas proporciona todas las herramientas de forma básicas de Figma: Rectángulo (<kbd>R</kbd>), Elipse (<kbd>O</kbd>), Línea (<kbd>L</kbd>), Polígono y Estrella. Polígono dibuja polígonos regulares (por defecto 3 lados). Estrella dibuja estrellas puntiagudas (por defecto 5 puntas) con `starInnerRadius` configurable. Todas las formas soportan relleno, trazo, resaltado al pasar el ratón y contorno de selección.

## Auto-Layout

Yoga WASM proporciona layout CSS flexbox. Los frames soportan: dirección (horizontal, vertical, wrap), gap, padding (uniforme o por lado), justify (start, center, end, space-between), align (start, center, end, stretch) y dimensionado de hijos (fijo, rellenar, ajustar). Shift+A alterna auto-layout en un frame o envuelve los nodos seleccionados.

## Edición de texto inline

Edición de texto nativa en el canvas — sin overlay de textarea DOM. Doble clic en un nodo de texto para entrar en modo de edición. El canvas renderiza un cursor parpadeante, rectángulos de selección azules translúcidos y un contorno azul alrededor del nodo. Navegación con teclado con soporte de modificadores: <kbd>⌥</kbd><kbd>←</kbd>/<kbd>→</kbd> para movimiento por palabra, <kbd>⌘</kbd><kbd>←</kbd>/<kbd>→</kbd> para inicio/fin de línea.

**Selector de fuentes** con scroll virtual, filtro de búsqueda y vista previa CSS de fuentes. En Tauri, las fuentes del sistema se enumeran vía el crate Rust `font-kit`. En el navegador, se usa la API Local Font Access cuando está disponible.

## Formateo de texto enriquecido

Formateo por carácter dentro de un nodo de texto. <kbd>⌘</kbd><kbd>B</kbd> para negrita, <kbd>⌘</kbd><kbd>I</kbd> para cursiva, <kbd>⌘</kbd><kbd>U</kbd> para subrayado, o usa los botones B/I/U/S en la sección Tipografía. Implementado vía un modelo StyleRun. El formateo de texto enriquecido se preserva durante import/export .fig.

## Deshacer/Rehacer

Toda operación es deshacible — creación/eliminación de nodos, movimientos, redimensionamientos, cambios de propiedades, cambios de padre, cambios de layout y todas las operaciones de variables. <kbd>⌘</kbd><kbd>Z</kbd> deshace, <kbd>⇧</kbd><kbd>⌘</kbd><kbd>Z</kbd> rehace.

## Guías de snap

Snap de bordes y centros con líneas guía rojas cuando los nodos se alinean. Consciente de la rotación — los cálculos de snap usan los límites visuales reales de nodos rotados.

## Reglas del canvas

Reglas en los bordes superior e izquierdo muestran escalas de coordenadas. Al seleccionar un nodo, las reglas resaltan su posición con una banda translúcida y muestran badges de coordenadas.

## Selector de color y tipos de relleno

Selección de color HSV con slider de tono, slider alfa, entrada hex y control de opacidad. El selector de tipo de relleno proporciona pestañas para Sólido, Gradiente (Lineal, Radial, Angular, Diamante) e Imagen.

## Panel de capas

Vista de árbol de la jerarquía del documento usando el componente Reka UI Tree. Expandir/colapsar frames, arrastrar para reordenar (cambia z-order), alternar visibilidad por nodo. Ambos paneles son redimensionables.

## Panel de propiedades

Interfaz con pestañas **Diseño** | **Código** | **IA** (reka-ui Tabs).

La pestaña **Diseño** es contextual con secciones: Apariencia (opacidad, radio de esquina, visibilidad), Relleno, Trazo, Efectos, Tipografía, Layout, Posición, Exportación y Página.

La pestaña **Código** muestra export JSX de la selección. La pestaña **IA** proporciona una interfaz de chat IA.

## Agrupar/Desagrupar

⌘G agrupa nodos seleccionados. ⇧⌘G desagrupa. Los nodos se ordenan por posición visual al agrupar.

## Secciones

Las secciones (<kbd>S</kbd>) son contenedores organizacionales de nivel superior en el canvas. Cada sección muestra una píldora de título. El color del texto se invierte automáticamente según la luminancia del fondo.

## Documentos multi-página

Los documentos soportan múltiples páginas como Figma. El panel de páginas permite añadir, eliminar y renombrar páginas. Cada página mantiene un estado de viewport independiente.

## Resaltado al pasar

Los nodos se resaltan al pasar con un contorno que sigue la geometría real — las elipses obtienen contornos elípticos, los rectángulos redondeados obtienen contornos redondeados, los vectores obtienen contornos de ruta.

## Renderizado avanzado (Tier 1)

El renderer CanvasKit soporta las características visuales completas de Tier 1: rellenos de gradiente (lineal, radial, angular, diamante), rellenos de imagen, efectos (sombra, desenfoque), propiedades de trazo (cap, join, dash), datos de arco, culling de viewport, reutilización de Paint y coalescencia RAF.

## Componentes e instancias

Crea componentes reutilizables desde frames o selecciones (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>K</kbd>). Combina componentes en un COMPONENT_SET (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>K</kbd>). Crea instancias desde componentes vía menú contextual. Desacopla una instancia de vuelta a un frame con <kbd>⌥</kbd><kbd>⌘</kbd><kbd>B</kbd>. "Ir al componente principal" navega al componente fuente.

**Sincronización en vivo:** Editar un componente principal propaga cambios a todas sus instancias automáticamente. **Soporte de overrides:** Las instancias mantienen un registro de overrides que se preservan durante la sincronización. Los componentes muestran etiquetas púrpura siempre visibles con icono de diamante.

## Variables

Tokens de diseño como variables con colecciones y modos. Diálogo con TanStack Table con columnas redimensionables. Soporta tipo COLOR con UI completa, tipos FLOAT/STRING/BOOLEAN definidos. Organiza variables en colecciones, define modos (ej: Claro/Oscuro). Vincula variables a colores de relleno. Cadenas de alias con detección de ciclos. Todas las operaciones de variables son deshacibles.

## Exportación de imágenes

Exporta nodos seleccionados como PNG, JPG o WEBP. Selección de escala (0,5×–4×), selector de formato, soporte multi-exportación y vista previa en vivo. Disponible vía menú contextual y <kbd>⇧</kbd><kbd>⌘</kbd><kbd>E</kbd>.

## Menú contextual

Clic derecho en el canvas abre un menú contextual estilo Figma con acciones de: Portapapeles, Orden Z, Agrupación, Componentes (ítems púrpura), Visibilidad y Mover a página.

## Orden Z, visibilidad y bloqueo

<kbd>]</kbd> trae nodos al frente, <kbd>[</kbd> envía al fondo. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>H</kbd> alterna visibilidad. <kbd>⇧</kbd><kbd>⌘</kbd><kbd>L</kbd> alterna bloqueo. Mover nodos entre páginas vía submenú "Mover a página".

## App web y de escritorio

OpenPencil funciona en el navegador en [app.openpencil.dev](https://app.openpencil.dev) — sin instalación requerida. La app de escritorio usa Tauri v2 (~5 MB vs ~100 MB de Electron). Funciona completamente offline. Menú nativo en todas las plataformas. Herramientas de desarrollador accesibles vía <kbd>⌘</kbd><kbd>⌥</kbd><kbd>I</kbd>.

## Menú de app (navegador)

En modo navegador, una barra de menú con reka-ui Menubar proporciona acceso a todas las acciones principales del editor. Seis menús: **Archivo**, **Editar**, **Ver**, **Objeto**, **Texto**, **Organizar**. Los atajos de teclado se muestran junto a cada ítem con etiquetas de modificador según la plataforma. Oculto en Tauri, que proporciona sus propios menús nativos.

## Autoguardado

Los archivos se guardan automáticamente 3 segundos después del último cambio de escena. Un watcher con debounce monitorea `sceneVersion`. Usa el plugin fs de Tauri en escritorio o la API File System Access en navegadores compatibles. El autoguardado está deshabilitado para documentos nuevos sin título hasta que el usuario realice un Guardar como explícito.

## Colaboración P2P

Colaboración peer-to-peer en tiempo real — sin servidor requerido. Comparte un enlace y edita junto. Basado en Trystero (WebRTC) para conexiones directas entre pares y Yjs (CRDT) para sincronización de documentos sin conflictos.

- **Zero costes de hosting** — señalización vía brokers MQTT públicos, datos fluyen directamente entre pares
- **Traversal NAT** — servidores Google STUN, Cloudflare STUN y Open Relay TURN
- **Cursores en vivo** — flechas de cursor coloreadas estilo Figma con borde blanco y píldoras de nombre
- **Presencia** — ve quién está en la sala con avatares coloreados
- **Modo seguimiento** — clic en el avatar de un par para seguir su viewport en tiempo real
- **Persistencia local** — y-indexeddb mantiene la sala entre recargas de página
- **Salas seguras** — IDs generados con `crypto.getRandomValues()`

## Pestañas multi-archivo

Abre múltiples documentos en pestañas dentro de una sola ventana. La barra de pestañas muestra archivos abiertos con botones de cierre. Clic medio en una pestaña para cerrarla. <kbd>⌘</kbd><kbd>N</kbd> o <kbd>⌘</kbd><kbd>T</kbd> — nueva pestaña, <kbd>⌘</kbd><kbd>W</kbd> — cerrar pestaña actual, <kbd>⌘</kbd><kbd>O</kbd> — abrir archivo en nueva pestaña.

## Renderizado de efectos

Renderizado completo de efectos Figma vía CanvasKit: **Sombra paralela** (offset, radio de desenfoque, extensión, color), **Sombra interior**, **Desenfoque de capa** (Gaussiano), **Desenfoque de fondo** (efecto cristal/esmerilado), **Desenfoque de primer plano**. Las sombras de texto se renderizan en glifos individuales. Cache SkPicture por nodo para rendimiento.

## Propiedades multi-selección

Selecciona múltiples nodos y edita propiedades compartidas a la vez. Los valores compartidos se muestran normalmente, los valores diferentes muestran "Mixed". Las entradas de ancho y alto funcionan a través de la selección. Voltear H/V se aplica a todos los nodos seleccionados.

## ScrubInput

Todas las entradas numéricas en el panel de propiedades usan interacción de arrastre para ajustar — arrastra horizontalmente para ajustar el valor, o haz clic para escribir directamente. Soporta sufijos (°, px, %).

## Builds CI/CD

GitHub Actions construye apps Tauri nativas en tags de versión. La matriz cubre macOS (arm64, x64), Windows (x64, arm64) y Linux (x64). Los builds de macOS están firmados y notarizados vía certificados Apple Developer. Las notas de release se auto-rellenan desde CHANGELOG.md.

## @open-pencil/core y CLI

El motor está extraído en `packages/core/` (@open-pencil/core) — sin dependencias DOM. El CLI (`packages/cli/`) proporciona operaciones headless .fig: info, tree, find, export, analyze (colors, typography, spacing, clusters), node, pages, variables, eval. Todos los comandos soportan `--json`.

El comando `eval` ejecuta JavaScript contra un archivo `.fig` con un objeto `figma` global compatible con Figma. Véase [Comando Eval](/eval-command) para la referencia completa.

## Renderizador JSX

Creación programática de diseño vía funciones TreeNode builder exportadas desde `@open-pencil/core`. Soporta props shorthand estilo Tailwind — `w`, `h`, `bg`, `rounded`, `flex`, `gap`, `p`/`px`/`py`.

## Chat IA

Asistente IA integrado accesible vía la pestaña IA o <kbd>⌘</kbd><kbd>J</kbd>. Comunica directamente con OpenRouter — sin servidor backend requerido.

**75 herramientas** definidas en `packages/core/src/tools/schema.ts`, cubriendo: operaciones de lectura, creación, modificación, manipulación de nodos, CRUD de variables, herramientas de rutas vectoriales, control de viewport y un escape hatch `eval`. Las herramientas están conectadas al chat IA (schemas valibot), servidor MCP (schemas zod) y CLI (comando `eval`).

**Servidor MCP** (`packages/mcp/`) expone todas las herramientas para herramientas de codificación IA externas. Dos transportes: stdio y HTTP con Hono. Añade 3 herramientas de gestión de archivos sobre las 75 herramientas core (= 78 en total), para 78 en total.

## Exportación SVG

Exporta nodos seleccionados como PNG, JPG, WEBP o SVG. CLI: `bun open-pencil export --format svg file.fig`.

## Copiar como

El submenú **Copiar como** del menú contextual ofrece: Copiar como texto, SVG, PNG (<kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd>), JSX.

## Alineación de trazo y pesos por lado

Alineación: **Interior**, **Centro** o **Exterior**. Pesos individuales por lado (Arriba/Derecha/Abajo/Izquierda) mediante el selector de lados.

## Layout móvil & PWA

Instalable como PWA. En móvil, paneles laterales reemplazados por cajón inferior deslizable con pestañas.

## Exportación Tailwind CSS v4

La pestaña Código ofrece alternancia entre **OpenPencil JSX** y **Tailwind CSS v4** (HTML con clases de utilidad).

## Google Fonts Fallback

Cuando una fuente no está disponible localmente, OpenPencil la carga automáticamente de Google Fonts API.

## Homebrew Tap

En macOS: `brew install open-pencil/tap/open-pencil`

## Renombrar capas inline

Doble clic en el nombre de una capa para renombrarla. Enter o clic fuera confirma, Escape cancela.

## Profiler de renderizado

Superposición HUD con métricas de tiempo de renderizado. Accesible desde el menú Vista.

## Panel de código

La pestaña Código muestra la representación JSX de la selección actual con resaltado de sintaxis Prism.js y botón de copia al portapapeles.

## Calidad de código

Detección de copia-pega vía jscpd — duplicación reducida de 15,6% a 0,62%. Pipeline de importación .fig optimizado de O(n²) a O(n).
