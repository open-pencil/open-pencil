# Hoja de ruta

## Fases

### Fase 1: Motor Core ✅

`SceneGraph`, renderizado Skia, formas básicas, selección, zoom/pan, deshacer/rehacer, guías de ajuste.

### Fase 2: UI del Editor + Layout ✅

Vue 3 + Reka UI panels, propiedades, capas, barra de herramientas, Yoga auto-layout, edición de texto inline, reglas del canvas.

### Fase 3: E/S de Archivos + Funciones Visuales ✅

Importación/exportación .fig, codec Kiwi, portapapeles, herramienta de pluma, redes vectoriales, grupos, Tauri v2 desktop, secciones, multi-página, resaltado hover, renderizado Tier 1.

### Fase 4: Componentes + Variables ✅

Componentes, instancias, overrides, conjuntos de componentes, variables (`COLOR`/FLOAT/STRING/BOOLEAN), colecciones, modos, exportación de imágenes, menú contextual, formateo de texto enriquecido.

### Fase 5: Integración IA & Herramientas ✅

**Entregado:**
- @open-pencil/core extraído a packages/core/ (sin dependencias DOM)
- @open-pencil/cli con operaciones headless .fig (info, tree, find, export, analyze, eval)
- Comando `eval` con API Plugin compatible con Figma
- Chat IA: conexión directa OpenRouter, 87 herramientas en `packages/core/src/tools/`, <kbd>⌘</kbd><kbd>J</kbd>
- 49 herramientas IA/MCP adicionales portadas de figma-use (75 en total)
- Servidor MCP (@open-pencil/mcp): stdio + HTTP, 87 herramientas core + 3 de gestión de archivos
- Definiciones de herramientas unificadas: definir una vez en `packages/core/src/tools/` (por dominio), adaptar para chat IA (valibot), MCP (zod), CLI (eval)
- Menú de aplicación para modo navegador
- Autoguardado: escritura con debounce de 3s
- Panel de propiedades multi-selección con valores compartidos/mixtos

**Planificado:**
- Modo adjunto: WebSocket al editor en ejecución
- Sistema de pautas de diseño

### Fase 6: Colaboración + Distribución 🟡

**Entregado:**
- Colaboración P2P vía Trystero (WebRTC) + Yjs CRDT — sin servidor relay
- Protocolo de awareness: cursores en vivo, selecciones, presencia
- Modo seguimiento: clic en avatar del par para seguir su viewport
- Persistencia local vía y-indexeddb
- Renderizado de efectos: sombra paralela, sombra interior, desenfoque de capa/fondo/primer plano
- Pestañas multi-archivo: <kbd>⌘</kbd><kbd>N</kbd>/<kbd>⌘</kbd><kbd>T</kbd> nueva pestaña, <kbd>⌘</kbd><kbd>W</kbd> cerrar, <kbd>⌘</kbd><kbd>O</kbd> abrir
- Firma de código Apple y notarización para macOS
- Builds Linux (x64) añadidos al CI
- Sitio de documentación VitePress con i18n (6 idiomas)

**Planificado:**
- Prototipado (conexiones de frames, transiciones, animaciones)
- Comentarios (pin, hilos, resolver)
- Soporte PWA
- Cambio de variantes, UI de variables `FLOAT`/STRING/BOOLEAN, theming por variables

## Cronograma

| Fase | Duración estimada | Estado |
|------|------------------|--------|
| Fase 1: Motor Core | 3 meses | ✅ Completada |
| Fase 2: UI del Editor + Layout | 3 meses | ✅ Completada |
| Fase 3: E/S de Archivos + Funciones Visuales | 2 meses | ✅ Completada |
| Fase 4: Componentes + Variables | 2 meses | ✅ Completada |
| Fase 5: Integración IA & Herramientas | 2 meses | ✅ Completada |
| Fase 6: Colaboración + Distribución | 2 meses | 🟡 En progreso |
