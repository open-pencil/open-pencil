# Translations

OpenPencil supports multiple languages through vue-i18n. This guide covers how to add new translations or improve existing ones.

## Supported Languages

| Code | Language | File |
|------|----------|------|
| `en` | English | `src/locales/en.json` |
| `zh-CN` | Simplified Chinese | `src/locales/zh-CN.json` |
| `zh-TW` | Traditional Chinese | `src/locales/zh-TW.json` |
| `fr` | French | `src/locales/fr.json` |
| `ko` | Korean | `src/locales/ko.json` |
| `ja` | Japanese | `src/locales/ja.json` |
| `de` | German | `src/locales/de.json` |
| `it` | Italian | `src/locales/it.json` |
| `ru` | Russian | `src/locales/ru.json` |

## Adding a New Language

1. Create a new JSON file in `src/locales/` (e.g., `pt-BR.json` for Brazilian Portuguese)
2. Copy the structure from `en.json` and translate all values
3. Add the language to the `SUPPORTED_LOCALES` array in `src/i18n/index.ts`
4. Add the language name to the `language` section in all locale files

### Example

```json
// src/locales/pt-BR.json
{
  "language": {
    "en": "English",
    "zhCN": "简体中文",
    "ptBR": "Português (Brasil)"
    // ... other languages
  },
  "menu": {
    "file": {
      "label": "Arquivo",
      "new": "Novo",
      "open": "Abrir…",
      // ... etc
    }
  }
}
```

## Translation Structure

The locale JSON files are organized by component/feature:

- **menu** — Menu bar items (File, Edit, View, etc.)
- **toolbar** — Tool labels and actions
- **panels** — Panel titles (Layers, Pages, Design, Code, AI)
- **properties** — Property panel sections (Appearance, Fill, Stroke, etc.)
- **dialogs** — Dialog titles and buttons
- **contextMenu** — Right-click menu items
- **chat** — AI chat panel labels
- **toast** — Toast notification messages
- **tooltips** — Tooltip text
- **errors** — Error messages
- **empty** — Empty state messages

## Using Translations in Components

Use `useI18n` from vue-i18n:

```vue
<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <button>{{ t('menu.file.save') }}</button>
</template>
```

## Interpolation

For dynamic values, use interpolation:

```json
{
  "chat": {
    "getApiKeyLink": "Get an {provider} API key →"
  }
}
```

```vue
<template>
  {{ t('chat.getApiKeyLink', { provider: providerDef.name }) }}
</template>
```

## Pluralization

vue-i18n supports pluralization:

```json
{
  "items": "1 item | {count} items"
}
```

```vue
<template>
  {{ t('items', { count: items.length }) }}
</template>
```

## Language Detection

The app detects the user's language in this order:

1. **localStorage** — Previously selected language
2. **Tauri locale** — System language (desktop app)
3. **Browser locale** — Browser language (web app)
4. **Fallback** — English (`en`)

## Testing Translations

1. Run `bun run check` to verify no type errors
2. Test language switching via the Language menu
3. Verify all UI text updates when changing language
4. Check for any hardcoded strings that should be translated

## Guidelines

- Keep translations concise — UI space is limited
- Use consistent terminology across the app
- Maintain the same JSON structure as `en.json`
- Don't translate keyboard shortcuts (e.g., `⌘S`, `Ctrl+C`)
- Technical terms like "JSX", "API", "MCP" typically stay in English

## Missing Translations

If a translation key is missing in a locale file, the app falls back to English. Check the browser console for warnings about missing keys during development.