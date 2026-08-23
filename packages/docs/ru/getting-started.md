# Начало работы

## Веб-версия

OpenPencil работает прямо в браузере и не требует установки. Чтобы начать работу, откройте [app.openpencil.dev](https://app.openpencil.dev).

Если вы хотите создать на основе OpenPencil собственный продукт, а не только пользоваться готовым приложением, перейдите в раздел [Программирование и автоматизация](/programmable/) или прочитайте документацию [Vue SDK](/programmable/sdk/).

## Приложение для компьютера

Готовые версии для macOS, Windows и Linux опубликованы на [странице релизов](https://github.com/open-pencil/open-pencil/releases/latest).

| Платформа | Файл |
|----------|------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Установка в macOS через Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

Команда устанавливает последнюю подписанную версию для компьютеров Mac с Apple Silicon или процессором Intel. Homebrew tap обновляется при каждом релизе.

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
|---------|------------|
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
