---
title: PageListRoot
description: Primitive structurelle headless pour les interfaces de liste de pages.
---

# PageListRoot

`PageListRoot` est une primitive structurelle headless pour les interfaces de liste de pages.

Elle fournit des props de slot pour :

- les pages
- l'identifiant de la page courante
- la détection des séparateurs
- les actions sur les pages comme ajouter, changer, renommer et supprimer

## Utilisation

Utilisez-la quand vous voulez la structure de liste de pages fournie par le SDK avec un rendu et des styles spécifiques à votre application.

## Exemple de base

```vue
<PageListRoot v-slot="{ pages, currentPageId, switchPage }">
  <ul>
    <li v-for="page in pages" :key="page.id">
      <button
        :data-active="page.id === currentPageId"
        @click="switchPage(page.id)"
      >
        {{ page.name }}
      </button>
    </li>
  </ul>
</PageListRoot>
```

## API associées

- [usePageList](../composables/use-page-list)
