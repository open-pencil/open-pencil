# Начало работы

## Веб-версия

OpenPencil работает прямо в браузере и не требует установки. Чтобы начать работу, откройте [app.openpencil.dev](https://app.openpencil.dev).

Если вы хотите создать на основе OpenPencil собственный продукт, а не только пользоваться готовым приложением, перейдите в раздел [Программирование и автоматизация](/programmable/) или прочитайте документацию [Vue SDK](/programmable/sdk/).

## Приложение для компьютера

Готовые версии для macOS, Windows и Linux опубликованы на [странице релизов](https://github.com/open-pencil/open-pencil/releases/latest).

| Платформа | Файл |
| --------------------- | -------------------- |
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Системные требования

OpenPencil отрисовывает графику через CanvasKit на WebGL и использует современные возможности веб-платформы, поэтому нужен свежий движок браузера. Веб-версия работает в Chrome 111, Edge 111, Firefox 128 и Safari 16.4 или новее; браузеры на основе Chromium, например Brave и Opera, ориентируются на версию своего Chrome. Приложение для компьютера отрисовывает интерфейс в системном WebView, поэтому нижняя граница определяется движком операционной системы:

| Платформа | Требование |
| --------- | ---------- |
| macOS | macOS 13 Ventura или новее с актуальными обновлениями Safari (Safari 16.4 вышел вместе с macOS 13.3). |
| Windows | Windows 10 или новее со средой Microsoft Edge WebView2 Evergreen, которая обновляется сама. |
| Linux | WebKitGTK 2.40 или новее (`webkit2gtk-4.1`). |

Если движок слишком старый, OpenPencil вместо пустого окна показывает, что нужно обновить. Если вы видите такое уведомление в системе, которая подходит под требования, воспользуйтесь ссылкой «Report a problem»: в ней уже указаны сведения о браузере и движке.

## Установка в macOS через Homebrew

```sh
brew install --cask openpencil
```

Команда устанавливает подписанное приложение для Mac с Apple Silicon или Intel из [официального каталога Homebrew](https://formulae.brew.sh/cask/openpencil). Обновления проходят проверку в Homebrew и могут появляться позже релизов на GitHub. До обновления каталога используйте [прямую загрузку](https://github.com/open-pencil/open-pencil/releases/latest). CLI устанавливается отдельно: `npm install -g @open-pencil/cli`.

Если вы использовали архивный собственный tap, перейдите так:

```sh
brew uninstall open-pencil/tap/open-pencil
brew install --cask openpencil
```

## Сборка из исходного кода

### Что потребуется

- [Bun](https://bun.sh/) — среда выполнения и менеджер пакетов;
- [Rust](https://rustup.rs/) — только для приложения Tauri.

### Установка

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

### Сервер для разработки

```sh
bun run dev
```

Редактор будет доступен по адресу `http://localhost:1420`.

### Команды

| Команда | Назначение |
| ------------------------------- | -------------------------------------------------------------------- |
| `bun run dev` | Запустить сервер разработки с HMR |
| `bun run build` | Собрать версию для публикации |
| `bun run check` | Запустить oxlint и проверку типов с помощью tsgo |
| `bun run test` | Запустить сквозные тесты и сравнение внешнего вида в Playwright |
| `bun run test:update` | Обновить эталонные снимки экрана |
| `bun run test:unit` | Запустить модульные тесты с помощью bun:test |
| `bun run docs:dev` | Запустить сервер разработки документации |
| `bun run docs:build` | Быстро собрать документацию для локальной проверки |
| `bun run docs:build:production` | Полностью собрать документацию для публикации, включая файлы для LLM |

## Приложение Tauri

Для сборки приложения Tauri нужны Rust и системные компоненты выбранной платформы.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Установите [Rust](https://rustup.rs/) с toolchain `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Установите [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) и выберите workload **Desktop development with C++**.
3. WebView2 уже входит в Windows 10 версии 1803 и новее, а также в Windows 11.
4. Выполните:
   ```sh
   bun run tauri dev
   ```

### Linux

В Debian или Ubuntu установите системные зависимости:

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Затем выполните:

```sh
bun run tauri dev
```

### Сборка установочного пакета

```sh
bun run tauri build                                    # Текущая платформа
bun run tauri build --target universal-apple-darwin    # Universal binary для macOS
```
