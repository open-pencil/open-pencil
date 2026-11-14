---
title: API de configuration régionale
description: Configurer langue, messages personnalisés et langue de repli du SDK.
---

# API de configuration régionale

Ces API permettent de choisir la langue du SDK et de remplacer certains messages.

- `locale` contient la configuration effective après application des préférences et de la langue de repli.
- `messages` contient le catalogue résolu.
- `t(key, params?)` traduit une clé.
- l’application peut fournir ses propres catalogues partiels.

Les clés et noms de configuration restent en anglais car ils font partie de l’API.

## Voir aussi

- [useI18n](../composables/use-i18n)
