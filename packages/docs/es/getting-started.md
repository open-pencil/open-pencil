# Primeros pasos

## Versión web

OpenPencil funciona directamente en el navegador y no requiere instalación. Abre [app.openpencil.dev](https://app.openpencil.dev) para empezar a diseñar.

Si quieres crear un producto basado en OpenPencil en lugar de limitarte a la aplicación predeterminada, consulta la sección [Automatización](/programmable/) y la documentación del [Vue SDK](/programmable/sdk/).

## Aplicación de escritorio

Las versiones preparadas para macOS, Windows y Linux están disponibles en la [página de versiones](https://github.com/open-pencil/open-pencil/releases/latest).

| Plataforma | Archivo |
|------------|---------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Instalación en macOS con Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

El comando instala la versión firmada más reciente para equipos Mac con Apple Silicon o procesador Intel. El tap de Homebrew se actualiza con cada versión.

## Compilación desde el código fuente

### Requisitos

- [Bun](https://bun.sh/) como runtime y package manager;
- [Rust](https://rustup.rs/) solo para la aplicación Tauri.

### Instalación

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

### Servidor de desarrollo

```sh
bun run dev
```

El editor estará disponible en `http://localhost:1420`.

### Comandos

| Comando | Finalidad |
|---------|-----------|
| `bun run dev` | Inicia el servidor de desarrollo con HMR |
| `bun run build` | Genera la versión de producción |
| `bun run check` | Ejecuta oxlint y comprueba los tipos con tsgo |
| `bun run test` | Ejecuta las pruebas E2E y de regresión visual con Playwright |
| `bun run test:update` | Actualiza las capturas de referencia |
| `bun run test:unit` | Ejecuta las pruebas unitarias con bun:test |
| `bun run docs:dev` | Inicia el servidor de desarrollo de la documentación |
| `bun run docs:build` | Genera rápidamente la documentación para verificarla en local |
| `bun run docs:build:production` | Genera la documentación completa para su publicación, incluidos los archivos para LLM |

## Aplicación Tauri

Para compilar la aplicación Tauri se necesitan Rust y los componentes del sistema correspondientes a cada plataforma.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Instala [Rust](https://rustup.rs/) con el toolchain `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Instala [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) y selecciona el workload **Desktop development with C++**.
3. WebView2 ya está incluido en Windows 10 a partir de la versión 1803 y en Windows 11.
4. Ejecuta:
   ```sh
   bun run tauri dev
   ```

### Linux

En Debian o Ubuntu, instala las dependencias del sistema:

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Después, ejecuta:

```sh
bun run tauri dev
```

### Generar un paquete de instalación

```sh
bun run tauri build                                    # Plataforma actual
bun run tauri build --target universal-apple-darwin    # Universal Binary para macOS
```
