# Compatibilidad con Figma

Comparación entre las funciones de Figma Design y el estado actual de OpenPencil.

::: tip Estado
✅ Compatible — funciona de principio a fin · 🟡 Parcial — existe el comportamiento principal, pero faltan algunas funciones · 🔲 No implementado
:::

**Cobertura:** 128 de 156 funciones consideradas — 112 ✅ completas, 16 🟡 parciales y 28 🔲 pendientes. Actualizado: 2026-10-27.

## Interfaz y navegación

| Función | Estado | Notas |
|---------|--------|-------|
| Barra de herramientas | ✅ | Barra inferior de estilo UI3: Mover, Marco/Sección, formas, Pluma/Lápiz, Texto, Mano y Comentario; personalizable y con selector de iconos |
| Panel de capas | ✅ | Árbol desplegable, reordenación por arrastre, visibilidad y anchura ajustable |
| Panel de páginas | ✅ | Crear, eliminar y renombrar páginas; estado de vista independiente |
| Panel de propiedades | ✅ | Apariencia, relleno, contorno, efectos, tipografía, disposición, guías de disposición, restricciones, posición, máscara, propiedades de componente, colores de la selección y exportación; anchura ajustable |
| Zoom y desplazamiento | ✅ | Rueda, gesto de pellizco, atajos, <kbd>Space</kbd> + arrastre, botón central y Mano (<kbd>H</kbd>) |
| Reglas | ✅ | Reglas superior e izquierda con intervalo de selección y coordenadas |
| Fondo del lienzo | ✅ | Fondo independiente por página |
| Guías | ✅ | Se arrastran desde las reglas al lienzo o a los marcos; se pueden seleccionar, mover, duplicar, eliminar y deshacer; se guardan en `.fig` |
| Menú de acciones | ✅ | <kbd>⌘</kbd><kbd>K</kbd> abre una paleta con búsqueda de acciones del editor y de la aplicación |
| Menú contextual | ✅ | Portapapeles, orden, grupos, componentes, visibilidad, bloqueo y cambio de página |
| Atajos | 🟡 | Herramientas, edición, operaciones booleanas, aplanar, máscaras, componentes, alineación, orden, navegación y formato de texto; faltan Escala (<kbd>K</kbd>), Flecha, Cuentagotas (<kbd>I</kbd>) y la herramienta de zoom |
| Buscar y sustituir | 🔲 | No hay búsqueda de texto en todo el documento |
| Contornos de capas | 🔲 | No hay vista alámbrica |
| Miniatura propia | 🔲 | Los archivos guardados muestran su primera página, como Figma cuando no hay página de portada; no puede elegirse otra |
| Paso de movimiento | 🔲 | 1 px y 10 px; sin valores personalizados |
| Menú de aplicación | ✅ | Archivo, Editar, Ver, Objeto, Texto y Organizar en navegador; menús nativos en Tauri |
| Herramientas de AI | 🟡 | 126 herramientas en el chat de AI, agentes de programación (ACP) y MCP; fotos de stock y vectorización de imágenes; sin generación de imágenes ni búsqueda con AI |

## Capas y formas

| Función | Estado | Notas |
|---------|--------|-------|
| Rectángulo, elipse, línea, polígono y estrella | ✅ | Formas básicas; lados e interior configurables |
| Marcos | ✅ | Recorte, coordenadas propias y creación y tamaños predefinidos como en Figma |
| Grupos | ✅ | <kbd>⌘</kbd><kbd>G</kbd> y <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> |
| Secciones | ✅ | Etiquetas, incorporación automática y texto adaptado a la luminancia |
| Arcos | ✅ | `arcData` con ángulos inicial/final y radio interior |
| Máscaras | ✅ | Usar como máscara (<kbd>⌥</kbd><kbd>⌘</kbd><kbd>M</kbd>); tipos alfa, vectorial y de luminancia en la sección Máscara |
| Tipos y jerarquía | ✅ | 19 tipos, mapa plano y árbol de relaciones |
| Selección | ✅ | Clic, Shift-clic y marco de selección |
| Alineación y posición | ✅ | Posición, giro y dimensiones |
| Copiar y pegar | ✅ | Portapapeles estándar, binario Kiwi y copiar como texto/SVG/PNG/JSX |
| Tamaño proporcional | 🟡 | Shift y el bloqueo de proporción las conservan; no hay herramienta Escala (<kbd>K</kbd>) que escale también contornos, efectos y texto |
| Bloqueo | ✅ | Los objetos bloqueados no se seleccionan ni mueven |
| Visibilidad | ✅ | Icono de ojo y atajo |
| Renombrar | ✅ | Doble clic; Enter, Escape o pérdida de foco finalizan |
| Adelantar y retrasar | ✅ | Corchetes y menú contextual |
| Mover a página | ✅ | Traslada la selección desde el menú contextual |
| Restricciones | ✅ | Izquierda, derecha, centro, estirar y escalar en cada eje desde la sección Restricciones; se aplican al cambiar el tamaño del contenedor, también en instancias |
| Selección inteligente | 🟡 | Alinear y distribuir desde el panel y el menú Organizar; sin tiradores de espaciado ni Tidy up |
| Guías de disposición | ✅ | Cuadrículas, columnas y filas en marcos con número, tipo, margen, medianil y color; estilos de cuadrícula; varios marcos a la vez |
| Medir distancias | ✅ | Mantén <kbd>⌥</kbd> y pasa el puntero para ver las distancias desde la selección |
| Edición múltiple | ✅ | Posición, tamaño, apariencia, relleno, contorno y efectos; las diferencias aparecen como `Mixed` |
| Objetos similares | 🔲 | No identifica objetos coincidentes |
| Copiar propiedades | ✅ | <kbd>⌥</kbd><kbd>⌘</kbd><kbd>C</kbd> / <kbd>⌥</kbd><kbd>⌘</kbd><kbd>V</kbd> mediante el portapapeles del sistema, también con Figma: rellenos, contornos, efectos, esquinas, estilos, variables, disposición automática entre marcos y estilo de texto entre capas de texto |
| Relaciones | ✅ | Jerarquía mediante `parentIndex` y cambio de contenedor por arrastre |

## Vectores

| Función | Estado | Notas |
|---------|--------|-------|
| Redes vectoriales | ✅ | Modelo compatible con Figma, no solo rutas simples |
| Pluma | ✅ | Esquinas, curvas de Bézier y rutas abiertas o cerradas |
| Lápiz | ✅ | Trazos a mano alzada suavizados en curvas; <kbd>⇧</kbd> para líneas rectas |
| Edición vectorial | 🟡 | Selección y arrastre de puntos, tiradores, segmentos y regiones; <kbd>⌘</kbd> curva; Suprimir divide rutas y la pluma las prolonga; sin simetría por punto ni controles de esquina |
| Operaciones booleanas | ✅ | Menú Objeto (<kbd>⌥</kbd><kbd>⇧</kbd><kbd>U</kbd> / <kbd>S</kbd> / <kbd>I</kbd> / <kbd>E</kbd>) y control en el panel; el resultado sigue siendo una capa booleana editable |
| Aplanar | ✅ | Aplanar (<kbd>⌥</kbd><kbd>⇧</kbd><kbd>F</kbd>) desde el menú Objeto y el menú contextual del lienzo |
| Convertir contorno | ✅ | Sustituye cada capa con contorno por su relleno y un vector del contorno, conservando giro, opacidad y efectos |
| Texto a rutas | ✅ | Convierte el texto en vectores a partir del trazado de los glifos de la fuente |
| Constructor de formas | 🔲 | No hay herramienta booleana interactiva |
| Desplazar ruta | 🔲 | No hay contracción o expansión |
| Simplificar ruta | 🔲 | No reduce puntos |

## Texto y tipografía

| Función | Estado | Notas |
|---------|--------|-------|
| Texto y edición directa | ✅ | `textarea` invisible, cursor, selección por palabra/arrastre/doble o triple clic e intervalos de estilo |
| Renderizado | ✅ | CanvasKit Paragraph para composición, saltos de línea y métricas |
| Fuentes del sistema | ✅ | Inter predeterminada, font-kit en Tauri y `queryLocalFonts` en navegador |
| Familia y estilo | ✅ | FontPicker con desplazamiento virtual, búsqueda y vista previa CSS |
| Tamaño e interlineado | ✅ | Editables en Tipografía |
| Alineación | ✅ | Izquierda, centro, derecha y justificado; alineación vertical superior, central e inferior |
| Estilos de texto | 🟡 | Estilo por caracteres durante la edición; aplica estilos de texto con nombre de `.fig`, bibliotecas y tokens de diseño; sin interfaz para crear o editar estilos |
| Modos de tamaño | ✅ | Anchura automática, altura automática y tamaño fijo en Disposición |
| Listas | ✅ | Listas con viñetas y numeradas, anidadas, con espaciado de lista y de párrafo y marcadores colgantes; <kbd>⇧</kbd><kbd>⌘</kbd><kbd>8</kbd> / <kbd>7</kbd> |
| Enlaces | 🟡 | Los enlaces en intervalos de caracteres se conservan en `.fig`, el portapapeles, HTML y la API de plugins; el panel no permite añadirlos |
| Emoji y símbolos | ✅ | Los emoji en color se dibujan con la fuente de emoji del sistema, se editan como un solo carácter y se conservan en `.fig` y el portapapeles |
| OpenType | 🟡 | Todas las funciones que define un archivo se renderizan y se conservan; el panel solo activa ligaduras, alternativas contextuales y kerning |
| Fuentes variables | ✅ | Los estilos con nombre usan sus valores de eje y el tamaño óptico sigue al tamaño de fuente, como en Figma; la sección Tipografía y la API de plugins ajustan cualquier eje, y el tamaño óptico puede fijarse a mano |
| CJK | ✅ | Fuentes alternativas CJK según el idioma, cargadas antes del primer dibujado, incluido el chino tradicional y las fuentes web divididas |
| RTL | ✅ | Dirección de texto Auto, LTR o RTL con composición del árabe; la disposición automática fluye de derecha a izquierda |
| Fuentes de iconos | ✅ | Material Symbols se dibuja con las fuentes variables de Google con cualquier grosor, relleno y grado; el selector de iconos añade colecciones de Iconify y SF Symbols (macOS 14+) |

## Colores, degradados e imágenes

| Función | Estado | Notas |
|---------|--------|-------|
| Selector de color | ✅ | Área de color, tono, transparencia, hexadecimal y campos RGB, HSL, HSB y OkHCL |
| Rellenos sólidos | ✅ | Color hexadecimal y opacidad |
| Degradado lineal | ✅ | Puntos y tiradores de transformación |
| Degradado radial | ✅ | Sombreadores CanvasKit |
| Degradado angular | ✅ | Degradado cónico |
| Degradado diamante | ✅ | Cuatro puntos |
| Rellenos de imagen | ✅ | Rellenar, Encajar, Recortar y Mosaico, con escala del mosaico y giro de 90° |
| Patrones | 🟡 | Los patrones importados de Figma se renderizan y se conservan; sin selector para crearlos o editarlos |
| Modos de fusión | ✅ | Fusión de capa, relleno y efecto, con paso a través en grupos y marcos |
| Imágenes y vídeo | 🟡 | Arrastrar o pegar PNG, JPEG, GIF, WebP, AVIF y SVG en el lienzo; sin vídeo |
| Ajustes de imagen | 🔲 | Sin exposición, contraste o saturación |
| Recorte | 🟡 | El modo Recortar del selector de relleno de imagen conserva el recorte; sin tiradores de recorte en el lienzo |
| Cuentagotas | 🔲 | No toma colores del lienzo |
| Colores de selección mixta | ✅ | La función Colores de la selección cambia un color en toda una selección múltiple |
| Modelos de color | ✅ | Campos hexadecimal, RGB, HSL, HSB y OkHCL con avisos de gama |

## Efectos y propiedades

| Función | Estado | Notas |
|---------|--------|-------|
| Sombra exterior | ✅ | Desplazamiento, desenfoque y color mediante filtros CanvasKit |
| Sombra interior | ✅ | Sombra interna |
| Desenfoque de capa | ✅ | Gaussiano |
| Desenfoque de fondo | ✅ | Contenido situado detrás |
| Desenfoque frontal | ✅ | Contenido situado delante |
| Grosor de contorno | ✅ | Configurable |
| Extremos | ✅ | `NONE`, `ROUND`, `SQUARE`, `ARROW_LINES`, `ARROW_EQUILATERAL` |
| Uniones | ✅ | Inglete, bisel y redonda |
| Guiones | ✅ | Patrón de tramo y espacio |
| Alineación de contorno | ✅ | Interior, centro y exterior con recorte compatible |
| Grosores independientes | ✅ | Superior, derecha, inferior e izquierda |
| Radio de esquina | ✅ | Común o por esquina; tiradores en el lienzo para rectángulos, polígonos y estrellas |
| Suavizado de esquina | ✅ | Control deslizante en Apariencia; las esquinas suavizadas se renderizan, admiten guiones y se conservan igual que en Figma |
| Varios rellenos/contornos | ✅ | Añadir, quitar, ocultar y fusionar cualquier número de rellenos y contornos; los contornos admiten degradados e imágenes |

## Disposición automática

| Función | Estado | Notas |
|---------|--------|-------|
| Flujo horizontal y vertical | ✅ | Yoga WASM Flexbox |
| Activar | ✅ | <kbd>⇧</kbd><kbd>A</kbd> en marco o selección |
| Separación | ✅ | Configurable |
| Relleno | ✅ | Común o por lado |
| Distribución | ✅ | Inicio, centro, final y espacio entre elementos |
| Alineación | ✅ | Inicio, centro, final y estirar |
| Tamaño de elementos | ✅ | Fijo, Rellenar y Ajustar |
| Salto de línea | ✅ | Flex wrap |
| Grid | ✅ | CSS Grid mediante una variante de Yoga con pistas, espacios y celdas combinadas |
| Flujos anidados | ✅ | Marcos con direcciones distintas |
| Reordenación por arrastre | ✅ | Indicador de inserción visible |
| Dimensiones mín./máx. | ✅ | Anchura y altura mínimas y máximas en Disposición, vinculables a variables numéricas |

## Componentes y sistemas de diseño

| Función | Estado | Notas |
|---------|--------|-------|
| Crear componentes | ✅ | Atajo y propiedades de texto, visibilidad, intercambio y variantes |
| Conjuntos | ✅ | Variantes dispersas multidimensionales, validación de duplicados y valor predeterminado |
| Instancias | ✅ | Recursos, inserción, propiedades, sustituciones, cambio de variante, sincronización y revisión |
| Variantes | ✅ | Combinaciones dispersas, creación, cambio y alternativa superior izquierda |
| Propiedades | ✅ | Booleanas, de texto, de intercambio de instancia y de ranura; exponer instancias anidadas y reordenar desde el panel |
| Propagación | ✅ | Los cambios principales llegan a las instancias y conservan sustituciones |
| Variables | ✅ | Los cuatro tipos en el diálogo de variables, con alias, fórmulas y valores por modo; vinculables a colores, tamaños, espaciado, tipografía, visibilidad y texto |
| Colecciones y modos | ✅ | Colecciones con modos; desde Apariencia se aplica un modo, o Auto, a capas y páginas |
| Estilos | 🟡 | Aplica y separa estilos de relleno, contorno, texto, efecto y cuadrícula de `.fig`, bibliotecas y tokens de diseño; sin interfaz para crearlos o editarlos |
| Bibliotecas | ✅ | Revisiones inmutables, publicación selectiva, activación, revisión, trabajo sin conexión y persistencia `.fig` |
| Separar instancia | ✅ | Convierte la instancia en marco |
| Ir al principal | ✅ | Navega al componente fuente incluso entre páginas |

## Prototipos

Conexiones, activadores, acciones, animaciones, transiciones, superposiciones, desplazamiento, flujos, lógica condicional, curvas y presentación a pantalla completa aún no están disponibles.

## Importación y exportación

| Función | Estado | Notas |
|---------|--------|-------|
| Importar `.fig` | ✅ | Códec Kiwi con 605 definiciones de esquema y unos 590 campos por `NodeChange` |
| Exportar `.fig` | ✅ | Kiwi, Zstd y miniatura; componentes guardados como `SYMBOL` para el viaje de ida y vuelta |
| Guardar / Guardar como | ✅ | Diálogos nativos, File System Access API y descarga alternativa en Safari |
| Pegar desde Figma | ✅ | Decodifica el binario Kiwi del portapapeles |
| Copiar a Figma | ✅ | Genera binario Kiwi legible por Figma |
| Importar Sketch | 🔲 | No hay analizador `.sketch` |
| Exportar imagen/SVG/PDF | ✅ | PNG, JPG, WEBP, SVG, PDF con las fuentes incrustadas cuando sus archivos lo permiten, PPTX y draw.io |
| Historial de versiones | 🟡 | Documentos de OpenPencil Cloud (en vista previa): guardar versiones con nombre, consultarlas, previsualizarlas, restaurarlas y duplicarlas; no disponible para archivos locales |
| Recursos entre herramientas | ✅ | Portapapeles de Figma y copiar como texto/SVG/PNG/JSX |

## API de plugins y scripting

| Función | Estado | Notas |
|---------|--------|-------|
| `eval` con Figma Plugin API | ✅ | JavaScript sin interfaz con objeto global `figma` compatible |

## Colaboración y modo de desarrollo

| Función | Estado | Notas |
|---------|--------|-------|
| Comentarios | ✅ | La herramienta Comentario (<kbd>C</kbd>) fija hilos a las capas, con respuestas, resolución y una lista filtrable; se guardan en `.fig` |
| Multijugador | ✅ | Salas P2P (Trystero y Yjs) con cursores, seguimiento de vista, llamadas de voz y cursores de agentes; sin servidor |
| Chat de cursor | 🔲 | No hay burbujas en el lienzo |
| Ramas y fusiones | 🔲 | No hay ramas de versión |
| Modo de desarrollo | 🟡 | La pestaña Código muestra la selección como design JSX, HTML, Vue o React con CSS o Tailwind; estados Ready for dev; sin modo de inspección con cotas |
| Code Connect | 🔲 | No enlaza componentes de diseño con código |
| Fragmentos de código | 🟡 | Design JSX, HTML, Vue y React con CSS o Tailwind y valores basados en tokens; sin Swift, Kotlin ni Compose |
| Tailwind CSS v4 | ✅ | HTML con clases de utilidad desde el panel Código, CLI o API |
| Figma para VS Code | 🔲 | Sin integración con extensión del editor |
| Servidor MCP | ✅ | `@open-pencil/mcp` con stdio y HTTP; 125 herramientas principales más herramientas de documento, historial y ajustes |
| CLI | ✅ | 24 comandos, entre ellos `info`, `tree`, `find`, `query`, `node`, `pages`, `variables`, `tokens`, `fonts`, `lint`, `analyze`, `export`, `import`, `convert`, `diff`, `eval` y `tool` |

## Figma Draw

| Función | Estado | Notas |
|---------|--------|-------|
| Herramientas de ilustración | 🔲 | Sin herramientas especializadas de Figma Draw |
| Transformaciones de patrones | 🔲 | Sin patrones repetidos con transformaciones |
