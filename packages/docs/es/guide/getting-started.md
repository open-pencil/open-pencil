# Primeros pasos

## Probar en línea

OpenPencil funciona en el navegador — sin instalación. Abre [app.openpencil.dev](https://app.openpencil.dev).

## Descargar la aplicación de escritorio

Binarios para macOS, Windows y Linux en la [página de releases](https://github.com/open-pencil/open-pencil/releases/latest).

| Plataforma | Descarga |
|------------|----------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Compilar desde el código fuente

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
bun run dev
```

Abre el editor en `http://localhost:1420`.

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `bun run dev` | Servidor de desarrollo con HMR |
| `bun run build` | Build de producción |
| `bun run check` | Lint + verificación de tipos |
| `bun run test` | Tests E2E (Playwright) |
| `bun run docs:dev` | Servidor de documentación |

## Aplicación de escritorio (Tauri)

Consulta la [versión en inglés](/guide/getting-started) para instrucciones detalladas por plataforma.
