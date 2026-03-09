# Начало работы

## Попробовать онлайн

OpenPencil работает в браузере — установка не требуется. Откройте [app.openpencil.dev](https://app.openpencil.dev), чтобы начать проектирование.

## Скачать десктоп-приложение

Собранные бинарные файлы для macOS, Windows и Linux доступны на [странице релизов](https://github.com/open-pencil/open-pencil/releases/latest).

| Платформа | Загрузка |
|----------|----------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |


## macOS через Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

Устанавливает последний подписанный релиз для macOS (Apple Silicon и Intel). Tap автоматически обновляется с каждым релизом.

## Сборка из исходников

### Предварительные требования

- [Bun](https://bun.sh/) (пакетный менеджер и среда выполнения)
- [Rust](https://rustup.rs/) (только для десктоп-приложения)

## Установка

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

## Сервер разработки

```sh
bun run dev
```

Открывает редактор по адресу `http://localhost:1420`.

## Доступные скрипты

| Команда | Описание |
|---------|-------------|
| `bun run dev` | Сервер разработки с HMR |
| `bun run build` | Продакшн-сборка |
| `bun run check` | Линтинг (oxlint) + проверка типов (tsgo) |
| `bun run test` | E2E визуальная регрессия (Playwright) |
| `bun run test:update` | Перегенерация эталонных скриншотов |
| `bun run test:unit` | Модульные тесты (bun:test) |
| `bun run docs:dev` | Сервер документации |
| `bun run docs:build` | Сборка сайта документации |

## Десктоп-приложение (Tauri)

Десктоп-приложение требует Rust и платформо-зависимые компоненты.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Установите [Rust](https://rustup.rs/) с тулчейном `stable-msvc`:
   ```sh
   rustup default stable-msvc
   ```
2. Установите [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) с компонентом «Разработка классических приложений на C++»
3. WebView2 предустановлен в Windows 10 (1803+) и Windows 11
4. Запустите:
   ```sh
   bun run tauri dev
   ```

### Linux

Установите системные зависимости (Debian/Ubuntu):

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Затем:

```sh
bun run tauri dev
```

### Сборка для распространения

```sh
bun run tauri build                                    # Текущая платформа
bun run tauri build --target universal-apple-darwin    # macOS universal
```
