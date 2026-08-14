---
title: Chat IA
description: Asistente IA integrado con más de 90 herramientas para crear y modificar diseños.
---

# Chat IA

Presiona <kbd>⌘</kbd><kbd>J</kbd> (<kbd>Ctrl</kbd> + <kbd>J</kbd>) para abrir el asistente IA. Describe lo que quieres — crea formas, establece estilos, gestiona el layout, trabaja con componentes y analiza tu diseño.

## Configuración

1. Abre el panel de chat IA (<kbd>⌘</kbd><kbd>J</kbd>)
2. Haz clic en el icono de ajustes
3. Elige un proveedor e introduce tu clave API
4. Selecciona un modelo

### Proveedores compatibles

| Proveedor | Modelos | Configuración |
|-----------|---------|---------------|
| **OpenRouter** | Claude, GPT-4, Gemini, DeepSeek y otros | Clave API de [openrouter.ai](https://openrouter.ai) |
| **Anthropic** | Claude 3.5 Sonnet, Claude 3 Opus, etc. | Clave API de [console.anthropic.com](https://console.anthropic.com) |
| **OpenAI** | GPT-4o, GPT-4, etc. | Clave API de [platform.openai.com](https://platform.openai.com) |
| **Google AI** | Gemini 2.0, Gemini 1.5, etc. | Clave API de [aistudio.google.dev](https://aistudio.google.dev) |
| **Compatible con OpenAI** | Cualquier endpoint con formato de API OpenAI | URL base personalizada + clave. Admite alternancia entre API de Completions y Responses. |
| **Compatible con Anthropic** | Cualquier endpoint con formato de API Anthropic | URL base personalizada + clave |

Sin backend ni suscripción: tu clave se comunica directamente con el proveedor. Las solicitudes del navegador están sujetas a la política CORS del proveedor, y la fiabilidad de las llamadas a herramientas en streaming varía entre despliegues. Consulta la referencia en inglés sobre [compatibilidad de proveedores y modelos BYOK](/programmable/byok-provider-compatibility) para ver resultados medidos y pruebas reproducibles.

## Funciones

El asistente tiene más de 90 herramientas en estas categorías:

- **Crear** — frames, formas, texto, componentes, páginas. Renderiza JSX para layouts complejos.
- **Estilo** — rellenos, contornos, efectos, opacidad, radio de borde, modos de fusión.
- **Layout** — auto-layout, grid, alineación, espaciado, dimensionamiento.
- **Componentes** — crear componentes, instancias, conjuntos de componentes. Gestionar sobrecargas.
- **Variables** — crear/editar variables, colecciones, modos. Vincular a rellenos.
- **Consultar** — buscar nodos, selectores XPath, leer propiedades, listar páginas, fuentes, selección.
- **Inspeccionar** — `get_jsx` para vista JSX, `diff_jsx` para diferencias estructurales, `describe` para rol semántico y problemas de diseño.
- **Analizar** — paleta de colores, auditoría tipográfica, consistencia de espaciado, detección de patrones.
- **Exportar** — PNG, SVG, JSX con clases Tailwind. Verificación visual mediante `export_image`.
- **Vector** — operaciones booleanas, manipulación de trazados.

## Verificación visual

El asistente puede verificar su trabajo visualmente. Después de crear o modificar diseños, utiliza `export_image` para capturar una imagen y verificar el resultado contra la solicitud original.

## Ejemplos de prompts

- "Crea una tarjeta con título, descripción y un botón azul"
- "Haz que todos los botones de esta página usen el mismo radio de borde"
- "¿Qué fuentes se usan en este archivo?"
- "Cambia el fondo del frame seleccionado a un degradado de azul a morado"
- "Exporta el frame seleccionado como SVG"
- "Muéstrame el JSX de este frame"

## Consejos

- Selecciona nodos antes de preguntar — el asistente sabe qué está seleccionado.
- Sé específico con colores, tamaños y posiciones para resultados precisos.
- El asistente puede modificar múltiples nodos en un solo mensaje.
- Usa "deshacer" en el editor — las mutaciones de IA admiten deshacer completo.
- Todos los layouts se recalculan automáticamente después de cada ejecución de herramienta.
