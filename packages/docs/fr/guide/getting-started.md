# Premiers pas

## Essayer en ligne

OpenPencil fonctionne dans le navigateur — aucune installation requise. Ouvrez [app.openpencil.dev](https://app.openpencil.dev).

## Télécharger l'application de bureau

Binaires pour macOS, Windows et Linux sur la [page des versions](https://github.com/open-pencil/open-pencil/releases/latest).

| Plateforme | Téléchargement |
|------------|----------------|
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Windows (x64) | `.msi` / `.exe` |
| Windows (ARM) | `.msi` / `.exe` |
| Linux (x64) | `.AppImage` / `.deb` |

## Compiler depuis les sources

```sh
git clone https://github.com/open-pencil/open-pencil.git
cd open-pencil
bun install
bun run dev
```

Ouvre l'éditeur sur `http://localhost:1420`.

## Commandes disponibles

| Commande | Description |
|----------|-------------|
| `bun run dev` | Serveur de développement avec HMR |
| `bun run build` | Build de production |
| `bun run check` | Lint + vérification des types |
| `bun run test` | Tests E2E (Playwright) |
| `bun run docs:dev` | Serveur de documentation |

## Application de bureau (Tauri)

Voir la [version anglaise](/guide/getting-started) pour les instructions détaillées par plateforme.
