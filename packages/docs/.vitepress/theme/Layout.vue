<script setup lang="ts">
import DefaultTheme from 'vitepress/theme'

import GitHubButton from './site/GitHubButton.vue'
import OpenAppButton from './site/OpenAppButton.vue'
import SiteFooter from './site/SiteFooter.vue'
import ThemeButton from './site/ThemeButton.vue'
</script>

<!-- The default layout with the editor as the header's button, GitHub and the theme beside it,
     and the site footer in place of VitePress's one-line footer. -->
<template>
  <DefaultTheme.Layout>
    <template #nav-bar-content-after>
      <ThemeButton />
      <GitHubButton />
      <OpenAppButton place="bar" />
    </template>
    <template #nav-screen-content-after>
      <OpenAppButton place="screen" />
    </template>
    <template #layout-bottom>
      <SiteFooter />
    </template>
  </DefaultTheme.Layout>
</template>

<style>
/*
 * From 1180px the header shows its settings as icons, instead of folding them into ⋯ below 1280px
 * as VitePress does: language, theme, and Discord, each a tile on hover, then the GitHub and
 * editor buttons. VitePress's theme switch gives way to the icon. Narrower, there is no room for
 * them beside the links, and VitePress's own ⋯ and menu stay.
 */
.VPNavBar .content-body .theme-button,
.VPNavBar .content-body .github {
  display: none;
}

@media (min-width: 1180px) {
  .VPNavBar .content-body .theme-button,
  .VPNavBar .content-body .github {
    display: inline-flex;
  }

  .VPNavBar .social-links .VPSocialLink[href*='github.com'] {
    display: none;
  }

  .VPNavBar .content-body .translations,
  .VPNavBar .content-body .social-links {
    display: flex;
    align-items: center;
  }

  .VPNavBar .content-body .appearance,
  .VPNavBar .content-body .extra {
    display: none;
  }

  .VPNavBar .content-body .translations {
    order: 1;
  }

  .VPNavBar .content-body .theme-button {
    order: 2;
  }

  .VPNavBar .content-body .social-links {
    order: 3;
  }

  .VPNavBar .content-body .github {
    order: 4;
  }

  .VPNavBar .content-body .open-app {
    order: 5;
  }

  /* The links a little closer, and search as its icon until 1400px, so the longest locales fit. */
  .VPNavBar .VPNavBarMenuLink {
    padding: 0 10px;
  }

  @media (max-width: 1399px) {
    .VPNavBar .VPNavBarSearchButton .text,
    .VPNavBar .VPNavBarSearchButton .keys {
      display: none;
    }
  }

  /* One divider, between the links and the icons; the rest would fall between hidden items. */
  .VPNavBar .content-body .appearance + .social-links::before,
  .VPNavBar .content-body .translations + .appearance::before {
    display: none;
  }
}

.VPNavBar .translations .button .text,
.VPNavBar .social-links .VPSocialLink,
.site-header-icon {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  min-width: 32px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    background-color 0.25s,
    color 0.25s;
}

.VPNavBar .translations .button:hover .text,
.VPNavBar .social-links .VPSocialLink:hover,
.site-header-icon:hover {
  background-color: var(--vp-c-default-soft);
  color: var(--vp-c-text-1);
}

.site-header-icon svg {
  width: 18px;
  height: 18px;
}

/*
 * Each icon's name, from its own label, below it on hover or keyboard focus. Language has none:
 * hovering it opens its menu, which the name would cover.
 */
.VPNavBar .social-links .VPSocialLink[aria-label]:is(:hover, :focus-visible)::after {
  content: attr(aria-label);
}

.VPNavBar .site-header-icon[data-tooltip]:is(:hover, :focus-visible)::after {
  content: attr(data-tooltip);
}

.VPNavBar .social-links .VPSocialLink[aria-label]:is(:hover, :focus-visible)::after,
.VPNavBar .site-header-icon[data-tooltip]:is(:hover, :focus-visible)::after {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  z-index: 10;
  padding: 4px 8px;
  border-radius: 6px;
  background-color: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-2);
  color: var(--vp-c-text-1);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transform: translateX(-50%);
  pointer-events: none;
}

/*
 * The language button keeps the bar's full height, its tile drawn on the icon inside: VitePress
 * opens the menu below the button, and a shorter one would leave a gap that closes the menu as
 * the pointer crosses it.
 */
.VPNavBar .translations .button {
  padding: 0;
}
</style>
