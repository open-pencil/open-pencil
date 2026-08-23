# Premiers pas

## Version web

OpenPencil fonctionne directement dans le navigateur et ne nécessite aucune installation. Ouvrez [app.openpencil.dev](https://app.openpencil.dev) pour commencer à créer.

Si vous souhaitez développer votre propre produit avec OpenPencil plutôt que vous limiter à l'application par défaut, consultez la section [Automatisation](/programmable/) et la documentation du [Vue SDK](/programmable/sdk/).

## Application de bureau

Les versions prêtes à l'emploi pour macOS, Windows et Linux sont disponibles sur la [page des versions](https://github.com/open-pencil/open-pencil/releases/latest).

| Plateforme | Fichier |
|------------|---------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Installation sous macOS avec Homebrew

```sh
brew install open-pencil/tap/open-pencil
```

Cette commande installe la dernière version signée pour les Mac équipés d'une puce Apple Silicon ou d'un processeur Intel. Le tap Homebrew est mis à jour à chaque version.

## Compiler le code source

### Prérequis

- [Bun](https://bun.sh/) comme runtime et package manager ;
- [Rust](https://rustup.rs/) uniquement pour l'application Tauri.

### Installation

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
```

### Serveur de développement

```sh
bun run dev
```

L'éditeur sera accessible à l'adresse `http://localhost:1420`.

### Commandes

| Commande | Rôle |
|----------|------|
| `bun run dev` | Démarrer le serveur de développement avec HMR |
| `bun run build` | Générer la version de production |
| `bun run check` | Exécuter oxlint et vérifier les types avec tsgo |
| `bun run test` | Exécuter les tests E2E et de régression visuelle avec Playwright |
| `bun run test:update` | Mettre à jour les captures de référence |
| `bun run test:unit` | Exécuter les tests unitaires avec bun:test |
| `bun run docs:dev` | Démarrer le serveur de développement de la documentation |
| `bun run docs:build` | Générer rapidement la documentation pour la vérifier en local |
| `bun run docs:build:production` | Générer la documentation complète pour publication, y compris les fichiers destinés aux LLM |

## Application Tauri

La compilation de l'application Tauri nécessite Rust et les composants système propres à chaque plateforme.

### macOS

```sh
xcode-select --install
cargo install tauri-cli --version "^2"
bun run tauri dev
```

### Windows

1. Installez [Rust](https://rustup.rs/) avec le toolchain `stable-msvc` :
   ```sh
   rustup default stable-msvc
   ```
2. Installez [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) et sélectionnez le workload **Desktop development with C++**.
3. WebView2 est déjà inclus dans Windows 10 à partir de la version 1803 et dans Windows 11.
4. Exécutez :
   ```sh
   bun run tauri dev
   ```

### Linux

Sous Debian ou Ubuntu, installez les dépendances système :

```sh
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Exécutez ensuite :

```sh
bun run tauri dev
```

### Générer un package d'installation

```sh
bun run tauri build                                    # Plateforme actuelle
bun run tauri build --target universal-apple-darwin    # Universal Binary pour macOS
```
