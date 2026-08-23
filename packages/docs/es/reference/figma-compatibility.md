# Compatibilidad con Figma

Comparación entre las funciones de Figma Design y el estado actual de OpenPencil.

::: tip Estado
✅ Compatible — funciona de principio a fin · 🟡 Parcial — existe el comportamiento principal, pero faltan algunas funciones · 🔲 No implementado
:::

**Cobertura:** 94 de 158 funciones consideradas — 76 ✅ completas, 18 🟡 parciales y 64 🔲 pendientes. Actualizado: 2026-03-07.

## Interfaz y navegación

| Función | Estado | Notas |
|---------|--------|-------|
| Barra de herramientas | ✅ | Barra inferior de estilo UI3: Selección, Marco, Sección, Rectángulo, Elipse, Línea, Texto, Mano y Pluma |
| Panel de capas | ✅ | Árbol desplegable, reordenación por arrastre, visibilidad y anchura ajustable |
| Panel de páginas | ✅ | Crear, eliminar y renombrar páginas; estado de vista independiente |
| Panel de propiedades | ✅ | Apariencia, relleno, contorno, efectos, tipografía, disposición y posición; anchura ajustable |
| Zoom y desplazamiento | ✅ | Rueda, gesto de pellizco, atajos, <kbd>Space</kbd> + arrastre, botón central y Mano (<kbd>H</kbd>) |
| Reglas | ✅ | Reglas superior e izquierda con intervalo de selección y coordenadas |
| Fondo del lienzo | ✅ | Fondo independiente por página |
| Guías | 🔲 | No hay guías arrastrables desde las reglas |
| Menú de acciones | 🔲 | No hay búsqueda rápida de acciones |
| Menú contextual | ✅ | Portapapeles, orden, grupos, componentes, visibilidad, bloqueo y cambio de página |
| Atajos | 🟡 | Principales, componentes, orden, visibilidad y bloqueo; faltan Escala, Flecha, Lápiz, Reflejar y parte del formato de texto |
| Buscar y sustituir | 🔲 | No hay búsqueda de texto en todo el documento |
| Contornos de capas | 🔲 | No hay vista alámbrica |
| Miniatura propia | 🔲 | Se genera al exportar, pero no puede elegirse |
| Paso de movimiento | 🔲 | 1 px y 10 px; sin valores personalizados |
| Menú de aplicación | ✅ | Archivo, Editar, Ver, Objeto, Texto y Organizar en navegador; menús nativos en Tauri |
| Herramientas de AI | 🟡 | 90 herramientas; sin imágenes generadas ni búsqueda con AI |

## Capas y formas

| Función | Estado | Notas |
|---------|--------|-------|
| Rectángulo, elipse, línea, polígono y estrella | ✅ | Formas básicas; lados e interior configurables |
| Marcos | ✅ | Recorte, coordenadas propias y tamaños predefinidos |
| Grupos | ✅ | <kbd>⌘</kbd><kbd>G</kbd> y <kbd>⇧</kbd><kbd>⌘</kbd><kbd>G</kbd> |
| Secciones | ✅ | Etiquetas, incorporación automática y texto adaptado a la luminancia |
| Arcos | ✅ | `arcData` con ángulos inicial/final y radio interior |
| Lápiz | 🔲 | No hay dibujo a mano alzada |
| Máscaras | 🔲 | No hay máscaras de forma |
| Tipos y jerarquía | ✅ | 17 tipos, mapa plano y árbol de relaciones |
| Selección | ✅ | Clic, Shift-clic y marco de selección |
| Alineación y posición | ✅ | Posición, giro y dimensiones |
| Copiar y pegar | ✅ | Portapapeles estándar, binario Kiwi y copiar como texto/SVG/PNG/JSX |
| Tamaño proporcional | 🟡 | Shift conserva proporciones; no hay herramienta Escala (<kbd>K</kbd>) |
| Bloqueo | ✅ | Los objetos bloqueados no se seleccionan ni mueven |
| Visibilidad | ✅ | Icono de ojo y atajo |
| Renombrar | ✅ | Doble clic; Enter, Escape o pérdida de foco finalizan |
| Adelantar y retrasar | ✅ | Corchetes y menú contextual |
| Mover a página | ✅ | Traslada la selección desde el menú contextual |
| Restricciones | 🔲 | No hay anclaje a bordes o centro al cambiar el tamaño del contenedor |
| Selección inteligente | 🔲 | No distribuye ni alinea uniformemente una selección múltiple |
| Guías de disposición | 🔲 | No hay columnas, filas o cuadrículas superpuestas |
| Medir distancias | 🔲 | No hay medición con Alt al pasar el puntero |
| Edición múltiple | ✅ | Posición, tamaño, apariencia, relleno, contorno y efectos; las diferencias aparecen como `Mixed` |
| Objetos similares | 🔲 | No identifica objetos coincidentes |
| Copiar propiedades | 🔲 | No copia rellenos, contornos o efectos entre capas |
| Relaciones | ✅ | Jerarquía mediante `parentIndex` y cambio de contenedor por arrastre |

## Vectores

| Función | Estado | Notas |
|---------|--------|-------|
| Redes vectoriales | ✅ | Modelo compatible con Figma, no solo rutas simples |
| Pluma | ✅ | Esquinas, curvas de Bézier y rutas abiertas o cerradas |
| Edición vectorial | 🟡 | Creación disponible; edición avanzada de vértices, curvado, eliminación y unión limitada |
| Operaciones booleanas | 🔲 | No hay unión, resta, intersección o exclusión |
| Aplanar | 🔲 | No combina rutas |
| Convertir contorno | 🔲 | No convierte contornos en rutas |
| Texto a rutas | 🔲 | No convierte texto en contornos vectoriales |
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
| Alineación | 🟡 | Alineación básica; faltan vertical y anchura/altura automáticas |
| Estilos de texto | 🟡 | Negrita, cursiva, subrayado y tachado por selección; sin estilos reutilizables con nombre |
| Modos de tamaño | 🔲 | Sin anchura automática, altura automática o tamaño fijo |
| Listas | 🔲 | No hay listas con viñetas o numeradas |
| Enlaces | 🔲 | No hay hipervínculos |
| Emoji y símbolos | 🔲 | Compatibilidad incompleta |
| OpenType | 🔲 | Sin ligaduras, alternativas estilísticas ni cifras tabulares |
| Fuentes variables | 🔲 | No permite ajustar peso, anchura o inclinación |
| CJK | 🔲 | Compatibilidad incompleta con chino, japonés y coreano |
| RTL | 🔲 | No hay disposición de derecha a izquierda |
| Fuentes de iconos | 🔲 | Sin tratamiento especial |

## Colores, degradados e imágenes

| Función | Estado | Notas |
|---------|--------|-------|
| Selector de color | ✅ | Campo HSV, tono, transparencia y hexadecimal |
| Rellenos sólidos | ✅ | Color hexadecimal y opacidad |
| Degradado lineal | ✅ | Puntos y tiradores de transformación |
| Degradado radial | ✅ | Sombreadores CanvasKit |
| Degradado angular | ✅ | Degradado cónico |
| Degradado diamante | ✅ | Cuatro puntos |
| Rellenos de imagen | ✅ | Datos binarios y modos Rellenar, Encajar, Recortar y Mosaico |
| Patrones | 🔲 | No hay patrones repetidos |
| Modos de fusión | 🔲 | No hay fusión de capa o relleno |
| Imágenes y vídeo | 🟡 | Renderiza rellenos de imagen; sin importación por arrastre ni vídeo |
| Ajustes de imagen | 🔲 | Sin exposición, contraste o saturación |
| Recorte | 🔲 | No hay recorte interactivo |
| Cuentagotas | 🔲 | No toma colores del lienzo |
| Colores de selección mixta | 🔲 | No modifica colores en una selección heterogénea |
| Modelos de color | 🟡 | HSV y hexadecimal; sin modos HSL o RGB |

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
| Radio de esquina | ✅ | Común o por esquina |
| Suavizado de esquina | 🔲 | No hay redondeo continuo |
| Varios rellenos/contornos | 🔲 | No apila varios por capa |

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
| Dimensiones mín./máx. | 🔲 | Sin restricciones para elementos secundarios |

## Componentes y sistemas de diseño

| Función | Estado | Notas |
|---------|--------|-------|
| Crear componentes | ✅ | Atajo y propiedades de texto, visibilidad, intercambio y variantes |
| Conjuntos | ✅ | Variantes dispersas multidimensionales, validación de duplicados y valor predeterminado |
| Instancias | ✅ | Recursos, inserción, propiedades, sustituciones, cambio de variante, sincronización y revisión |
| Variantes | ✅ | Combinaciones dispersas, creación, cambio y alternativa superior izquierda |
| Propiedades | ✅ | Visibilidad booleana, texto e intercambio de instancia |
| Propagación | ✅ | Los cambios principales llegan a las instancias y conservan sustituciones |
| Variables | 🟡 | Interfaz completa para `COLOR`; edición incompleta para `FLOAT`, `STRING` y `BOOLEAN` |
| Colecciones y modos | 🟡 | Colecciones, modos y modo activo; sin tematización guiada por variables |
| Estilos | 🔲 | No hay valores reutilizables con nombre |
| Bibliotecas | ✅ | Revisiones inmutables, publicación selectiva, activación, revisión, trabajo sin conexión y persistencia `.fig` |
| Separar instancia | ✅ | Convierte la instancia en marco |
| Ir al principal | ✅ | Navega al componente fuente incluso entre páginas |

## Prototipos

Conexiones, activadores, acciones, animaciones, transiciones, superposiciones, desplazamiento, flujos, lógica condicional, curvas y presentación a pantalla completa aún no están disponibles.

## Importación y exportación

| Función | Estado | Notas |
|---------|--------|-------|
| Importar `.fig` | ✅ | Códec Kiwi con 194 definiciones y unos 390 campos por `NodeChange` |
| Exportar `.fig` | ✅ | Kiwi, Zstd y miniatura; componentes guardados como `SYMBOL` para el viaje de ida y vuelta |
| Guardar / Guardar como | ✅ | Diálogos nativos, File System Access API y descarga alternativa en Safari |
| Pegar desde Figma | ✅ | Decodifica el binario Kiwi del portapapeles |
| Copiar a Figma | ✅ | Genera binario Kiwi legible por Figma |
| Importar Sketch | 🔲 | No hay analizador `.sketch` |
| Exportar imagen/SVG/PDF | 🟡 | PNG, JPG, WEBP y SVG ✅; PDF 🔲 |
| Historial de versiones | 🔲 | No consulta ni restaura versiones anteriores |
| Recursos entre herramientas | ✅ | Portapapeles de Figma y copiar como texto/SVG/PNG/JSX |

## API de plugins y scripting

| Función | Estado | Notas |
|---------|--------|-------|
| `eval` con Figma Plugin API | ✅ | JavaScript sin interfaz con objeto global `figma` compatible |

## Colaboración y modo de desarrollo

| Función | Estado | Notas |
|---------|--------|-------|
| Comentarios | 🔲 | Sin marcadores, hilos o resolución |
| Multijugador | ✅ | P2P con Trystero y Yjs CRDT, cursores y seguimiento de vista; sin servidor |
| Chat de cursor | 🔲 | No hay burbujas en el lienzo |
| Ramas y fusiones | 🔲 | No hay ramas de versión |
| Modo de desarrollo | 🟡 | La pestaña Código muestra JSX; sin propiedades CSS ni especificaciones de entrega |
| Code Connect | 🔲 | No enlaza componentes de diseño con código |
| Fragmentos de código | 🟡 | JSX con resaltado y copia; sin Swift/Kotlin |
| Tailwind CSS v4 | ✅ | HTML con clases de utilidad desde el panel Código, CLI o API |
| Figma para VS Code | 🔲 | Sin integración con extensión del editor |
| Servidor MCP | ✅ | `@open-pencil/mcp` con stdio y HTTP; 90 herramientas en total |
| CLI | ✅ | `info`, `tree`, `find`, `export`, `analyze`, `node`, `pages`, `variables` y `eval` |

## Figma Draw

| Función | Estado | Notas |
|---------|--------|-------|
| Herramientas de ilustración | 🔲 | Sin herramientas especializadas de Figma Draw |
| Transformaciones de patrones | 🔲 | Sin patrones repetidos con transformaciones |
