# Matriz de características de Figma

Comparación característica por característica de las capacidades de Figma Design con el estado de implementación actual de Open Pencil.

::: tip Leyenda de estado
✅ Soportado — la característica funciona de extremo a extremo · 🟡 Parcial — el comportamiento base existe, faltan algunas sub-características · 🔲 Aún no implementado
:::

**Cobertura:** 94 de 158 ítems de características de Figma abordados — 76 ✅ completamente soportados, 18 🟡 parciales, 64 🔲 pendientes. Última actualización: 2026-03-07.

## Interfaz y navegación

| Característica | Estado | Notas |
|---------------|--------|-------|
| Barra de herramientas de diseño | ✅ | Barra inferior (estilo UI3): Seleccionar, Frame, Sección, Rectángulo, Elipse, Línea, Texto, Mano, Pluma |
| Panel de capas (barra lateral izquierda) | ✅ | Vista de árbol con expandir/colapsar, reordenamiento por arrastre, toggle de visibilidad; ancho redimensionable |
| Panel de páginas | ✅ | Añadir, eliminar, renombrar páginas; estado de viewport por página |
| Panel de propiedades (barra lateral derecha) | ✅ | Secciones: Apariencia, Relleno, Trazo, Efectos, Tipografía, Layout, Posición; ancho redimensionable |
| Zoom y pan | ✅ | Ctrl+scroll, pinch, ⌘+/⌘−/⌘0, espacio+arrastrar, ratón medio, herramienta mano (H) |
| Reglas del canvas | ✅ | Reglas superior/izquierda con bandas de selección y badges de coordenadas |
| Color de fondo del canvas | ✅ | Fondo por página vía panel de propiedades |
| Guías del canvas | 🔲 | Figma soporta guías arrastrables desde las reglas |
| Menú de acciones / paleta de comandos | 🔲 | Búsqueda de acciones rápidas de Figma |
| Menú contextual | ✅ | Clic derecho con portapapeles, orden-z, agrupación, componente, visibilidad, bloqueo, mover-a-página |
| Atajos de teclado | 🟡 | Atajos core + componentes + orden-z + visibilidad/bloqueo implementados; Escalar, Flecha, Lápiz, volteo, formateo de texto aún no conectados |
| Buscar y reemplazar | 🔲 | Búsqueda/reemplazo de texto en el documento |
| Vista de contornos de capas | 🔲 | Vista wireframe de todas las capas |
| Miniaturas personalizadas | 🔲 | Miniatura generada en export, pero sin selector de miniatura personalizada |
| Configuración de valores de nudge | 🔲 | Por defecto 1px/10px; Figma permite valores personalizados |
| Menú de app (modo navegador) | ✅ | Menús Archivo, Editar, Ver, Objeto, Texto, Organizar; Tauri usa menús nativos |
| Herramientas IA | 🟡 | 78 herramientas vía OpenRouter + servidor MCP; sin imágenes generadas por IA ni búsqueda IA aún |

## Capas y formas

| Característica | Estado | Notas |
|---------------|--------|-------|
| Herramientas de forma (Rectángulo, Elipse, Línea, Polígono, Estrella) | ✅ | Todos los tipos de forma básicos; lados del polígono y radio interior de estrella configurables |
| Frames | ✅ | Recorte de contenido, sistema de coordenadas independiente |
| Grupos | ✅ | ⌘G para agrupar, ⇧⌘G para desagrupar |
| Secciones | ✅ | Píldoras de título, auto-adopción de nodos superpuestos, texto adaptativo a luminancia |
| Herramienta de arco (arcos, semicírculos, anillos) | ✅ | arcData con ángulo inicio/fin y radio interior |
| Herramienta de lápiz (mano alzada) | 🔲 | Herramienta de dibujo a mano alzada de Figma |
| Máscaras | 🔲 | Máscaras de forma para recortar capas |
| Tipos de capa y jerarquía | ✅ | 17 tipos de nodo, Map plano + árbol padre-hijo |
| Seleccionar capas | ✅ | Clic, shift-clic, selección por marquesina |
| Alineación y posición | ✅ | Posición, rotación, dimensiones en el panel de propiedades |
| Copiar y pegar objetos | ✅ | Portapapeles estándar + formato binario Kiwi de Figma |
| Escalar capas proporcionalmente | 🟡 | Shift-redimensionar mantiene proporciones; sin herramienta Scale dedicada (K) |
| Bloquear y desbloquear capas | ✅ | ⇧⌘L alterna bloqueo; nodos bloqueados no se pueden seleccionar/mover |
| Alternar visibilidad de capa | ✅ | Icono de ojo en panel de capas + atajo ⇧⌘H |
| Renombrar capas | ✅ | Doble clic para renombrar inline; Enter/Escape/clic para confirmar |
| Traer al frente / Enviar al fondo | ✅ | Atajos ] y [; también en menú contextual |
| Mover a página | ✅ | Mover nodos entre páginas vía menú contextual |
| Restricciones (redimensionamiento responsivo) | 🔲 | Fijar bordes/centro para comportamiento de resize del padre |
| Selección inteligente (distribuir/alinear) | 🔲 | Espaciar y alinear uniformemente multi-selección |
| Guías de layout (columnas, filas, grid) | 🔲 | Guías de columna/fila/grid en frames |
| Medir distancias entre capas | 🔲 | Alt-hover para mostrar distancias |
| Editar objetos en lote | ✅ | Panel de propiedades multi-selección: editar posición, tamaño, apariencia, relleno, trazo, efectos; valores compartidos normales, diferentes muestran "Mixed" |
| Identificar objetos coincidentes | 🔲 | Encontrar capas similares |
| Copiar/pegar propiedades | 🔲 | Copiar relleno/trazo/efectos entre capas |
| Relaciones padre-hijo | ✅ | Jerarquía completa con parentIndex, re-parentamiento por arrastre |

## Herramientas vectoriales

| Característica | Estado | Notas |
|---------------|--------|-------|
| Redes vectoriales | ✅ | Modelo compatible con Figma, no rutas simples |
| Herramienta pluma | ✅ | Puntos de esquina, curvas bezier, rutas abiertas/cerradas |
| Editar capas vectoriales | 🟡 | Creación funciona; edición avanzada de vértices limitada |
| Operaciones booleanas (Unión, Sustracción, Intersección, Exclusión) | 🔲 | Combinar formas con ops booleanas |
| Aplanar capas | 🔲 | Fusionar rutas vectoriales en una sola |
| Convertir trazos a rutas | 🔲 | Comando Outline Stroke |
| Convertir texto a rutas | 🔲 | Aplanar texto a contornos vectoriales |
| Herramienta shape builder | 🔲 | Herramienta booleana interactiva |
| Offset de ruta | 🔲 | Inset/outset de una ruta vectorial |
| Simplificar ruta | 🔲 | Reducir cantidad de puntos vectoriales |

## Texto y tipografía

| Característica | Estado | Notas |
|---------------|--------|-------|
| Herramienta de texto y edición inline | ✅ | Edición nativa en canvas, textarea fantasma, cursor/selección/selección de palabra, arrastre, doble/triple clic, style runs (⌘B/I/U, botón S) |
| Renderizado de texto (Paragraph API) | ✅ | CanvasKit Paragraph para shaping, saltos de línea, métricas |
| Carga de fuentes (fuentes del sistema) | ✅ | Inter por defecto, font-kit en Tauri con cache OnceLock, queryLocalFonts en navegador |
| Familia y peso de fuente | ✅ | FontPicker con scroll virtual, búsqueda, vista previa CSS |
| Tamaño de fuente y altura de línea | ✅ | Editable en sección de tipografía |
| Alineación de texto | 🟡 | Alineación básica; Figma tiene alineación vertical y modos auto-ancho/alto |
| Estilos de texto | 🟡 | Negrita/cursiva/subrayado/tachado por selección; sin presets de estilo reutilizables aún |
| Modos de redimensionamiento de texto | 🔲 | Modos auto-ancho, auto-alto, tamaño-fijo de Figma |
| Listas con viñetas y numeradas | 🔲 | Formateo de listas en texto |
| Enlaces en texto | 🔲 | Hipervínculos dentro del contenido de texto |
| Emojis y símbolos inteligentes | 🔲 | Renderizado de emojis y caracteres especiales |
| Características OpenType | 🔲 | Ligaduras, alternativas estilísticas, figuras tabulares |
| Fuentes variables | 🔲 | Ejes de fuente ajustables (peso, ancho, inclinación) |
| Soporte texto CJK | 🔲 | Renderizado de texto chino, japonés, coreano |
| Soporte texto RTL | 🔲 | Layout de texto de derecha a izquierda |
| Fuentes de iconos | 🔲 | Manejo especial para glifos de fuentes de iconos |

## Color, gradientes e imágenes

| Característica | Estado | Notas |
|---------------|--------|-------|
| Selector de color (HSV) | ✅ | Cuadrado HSV, slider de tono, slider alfa, entrada hex |
| Rellenos sólidos | ✅ | Color hex con opacidad |
| Gradiente lineal | ✅ | Paradas de gradiente, asas de transformación |
| Gradiente radial | ✅ | Renderizado vía shaders CanvasKit |
| Gradiente angular | ✅ | Soporte gradiente sweep/cónico |
| Gradiente diamante | ✅ | Gradiente diamante de cuatro puntos |
| Rellenos de imagen | ✅ | Decodificados de datos blob con modos de escala (fill, fit, crop, tile) |
| Rellenos de patrón | 🔲 | Rellenos de imagen/patrón repetitivo |
| Modos de mezcla | 🔲 | Modos de mezcla de capa y relleno (multiply, screen, overlay, etc.) |
| Añadir imágenes y vídeos | 🟡 | Rellenos de imagen renderizados; sin import drag-and-drop ni soporte de vídeo |
| Ajuste de propiedades de imagen | 🔲 | Exposición, contraste, saturación, etc. |
| Recortar una imagen | 🔲 | Recorte interactivo de imágenes |
| Herramienta cuentagotas | 🔲 | Muestrear colores del canvas |
| Edición de color en selección mixta | 🔲 | Ajustar colores en selección heterogénea |
| Modelos de color (RGB, HSL, HSB, Hex) | 🟡 | HSV + Hex en selector; sin toggle de modo HSL o RGB |

## Efectos y propiedades

| Característica | Estado | Notas |
|---------------|--------|-------|
| Sombra paralela | ✅ | Offset, radio de desenfoque, color vía filtros CanvasKit |
| Sombra interior | ✅ | Efecto de sombra inset |
| Desenfoque de capa | ✅ | Desenfoque gaussiano en la capa |
| Desenfoque de fondo | ✅ | Desenfocar contenido detrás de la capa |
| Desenfoque de primer plano | ✅ | Desenfoque en primer plano |
| Grosor de trazo | ✅ | Configurable en panel de propiedades |
| Cap de trazo (round, square, arrow) | ✅ | NONE, ROUND, SQUARE, ARROW_LINES, ARROW_EQUILATERAL |
| Join de trazo (miter, bevel, round) | ✅ | Los tres tipos de join |
| Patrones de guiones | ✅ | Patrón de trazo dash-on/dash-off |
| Radio de esquina | ✅ | Radio uniforme y por esquina con toggle independiente |
| Suavizado de esquina (estilo iOS) | 🔲 | Redondeo continuo de esquinas de Figma |
| Múltiples rellenos/trazos por capa | 🔲 | Figma permite apilar rellenos y trazos |

## Auto Layout

| Característica | Estado | Notas |
|---------------|--------|-------|
| Flujo horizontal y vertical | ✅ | Motor flexbox Yoga WASM |
| Alternar auto layout (⇧A) | ✅ | Alternar en frame o envolver selección |
| Gap (espaciado entre hijos) | ✅ | Configurable en panel de propiedades |
| Padding (uniforme y por lado) | ✅ | Los cuatro lados independientemente |
| Justify content | ✅ | Start, center, end, space-between |
| Align items | ✅ | Start, center, end, stretch |
| Dimensionado de hijos (fijo, rellenar, ajustar) | ✅ | Modos de dimensionado por hijo |
| Wrap | ✅ | Flex wrap para layout multi-línea |
| Flujo auto layout grid | 🔲 | Auto layout basado en grid de Figma |
| Flujos combinados (anidados) | ✅ | Frames auto-layout anidados con diferentes direcciones |
| Reordenar arrastrando en auto layout | ✅ | Indicador visual de inserción |
| Ancho/alto mínimo y máximo | 🔲 | Figma soporta restricciones min/max en hijos de auto-layout |

## Componentes y sistemas de diseño

| Característica | Estado | Notas |
|---------------|--------|-------|
| Crear componentes | 🟡 | ⌥⌘K crea desde frame/grupo o envuelve selección; sin UI de propiedades de componente aún |
| Conjuntos de componentes | 🟡 | ⇧⌘K combina componentes; borde punteado púrpura; sin edición de propiedades de variante |
| Instancias de componentes | 🟡 | Crear instancia desde menú contextual con clonación de hijos y mapeo componentId; sync en vivo; sin UI de edición de overrides |
| Variantes | 🔲 | Cambio de variante y selección por propiedades |
| Propiedades de componente | 🔲 | Propiedades booleanas, texto, intercambio de instancia |
| Propagación de overrides | ✅ | Cambios en componente principal se propagan; overrides preservados |
| Variables (color, número, string, booleano) | 🟡 | COLOR con UI completa; FLOAT/STRING/BOOLEAN definidos sin UI de edición |
| Colecciones y modos de variables | 🟡 | Colecciones, modos, cambio activeMode funcionan; sin UI de theming por variable |
| Estilos (color, texto, efecto, layout) | 🔲 | Presets de estilo reutilizables con nombre |
| Bibliotecas (publicar, compartir, actualizar) | 🔲 | Bibliotecas compartidas de componentes/estilos |
| Desacoplar instancia | ✅ | ⌥⌘B convierte instancia en frame |
| Ir al componente principal | ✅ | Navegar al componente fuente, cross-page |

## Prototipado

| Característica | Estado | Notas |
|---------------|--------|-------|
| Conexiones de prototipo | 🔲 | Planificado para Fase 6 |
| Triggers (clic, hover, arrastrar, etc.) | 🔲 | Planificado para Fase 6 |
| Acciones (navegar, overlay, scroll, etc.) | 🔲 | Planificado para Fase 6 |
| Animaciones y transiciones | 🔲 | Planificado para Fase 6 |
| Smart animate | 🔲 | Auto-animar capas coincidentes |
| Overlays | 🔲 | Prototipado modal/popover |
| Comportamiento de scroll y overflow | 🔲 | Frames scrolleables en prototipos |
| Flujos de prototipo | 🔲 | Puntos de inicio con nombre |
| Variables en prototipos | 🔲 | Lógica condicional con variables |
| Easing y animaciones spring | 🔲 | Curvas de animación personalizadas |
| Presentar y reproducir prototipos | 🔲 | Visor de prototipo a pantalla completa |

## Import y export

| Característica | Estado | Notas |
|---------------|--------|-------|
| Import de archivo .fig | ✅ | Codec Kiwi completo: 194 definiciones, ~390 campos por NodeChange |
| Export de archivo .fig | ✅ | Codificación Kiwi + compresión Zstd + generación de miniatura |
| Guardar / Guardar como | ✅ | ⌘S / ⇧⌘S; diálogos nativos (Tauri), File System Access API (Chrome/Edge), fallback de descarga (Safari) |
| Portapapeles de Figma (pegar) | ✅ | Decodificar binario Kiwi del portapapeles de Figma |
| Portapapeles de Figma (copiar) | ✅ | Codificar binario Kiwi que Figma puede leer |
| Import de archivo Sketch | 🔲 | Parseo de archivos .sketch |
| Export de imagen/SVG/PDF | 🟡 | PNG/JPG/WEBP/SVG export ✅; PDF export 🔲 |
| Historial de versiones | 🔲 | Navegar y restaurar versiones anteriores |
| Copiar assets entre herramientas | ✅ | Portapapeles Figma (Kiwi binary), Copiar como texto/SVG/PNG/JSX |

## API de plugins y scripting

| Característica | Estado | Notas |
|---------------|--------|-------|
| Comando eval con Figma Plugin API | ✅ | Ejecución headless de JavaScript con objeto global figma compatible con la superficie de plugins de Figma |

## Colaboración y modo desarrollo

| Característica | Estado | Notas |
|---------------|--------|-------|
| Comentarios (fijar, hilos, resolver) | 🔲 | Planificado para Fase 6 |
| Multiplayer en tiempo real | ✅ | P2P vía Trystero + Yjs CRDT, cursores, modo seguimiento; sin servidor |
| Chat en cursor | 🔲 | Burbujas de chat inline en el cursor |
| Branching y merging | 🔲 | Ramas de versiones para archivos de diseño |
| Modo desarrollo (inspeccionar) | 🟡 | Pestaña Código muestra JSX de la selección; sin propiedades CSS ni specs de handoff |
| Code Connect | 🔲 | Vincular componentes de diseño a código |
| Fragmentos de código | 🟡 | Export JSX con resaltado y copia; sin fragmentos CSS/Swift/Kotlin |
| Figma for VS Code | 🔲 | Integración con plugin de editor |
| Servidor MCP | ✅ | @open-pencil/mcp con transportes stdio + HTTP; 75 herramientas core + 3 de gestión de archivos = 78 total |
| Herramientas CLI | ✅ | CLI headless: info, tree, find, export, analyze, node, pages, variables, eval; servidor MCP |

## Figma Draw

| Característica | Estado | Notas |
|---------------|--------|-------|
| Herramientas de ilustración | 🔲 | Herramientas de dibujo especializadas de Figma Draw |
| Transformaciones de patrón | 🔲 | Crear patrones repetitivos con transformaciones |
