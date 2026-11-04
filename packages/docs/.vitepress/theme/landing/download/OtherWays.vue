<script setup lang="ts">
import IconBeer from '~icons/lucide/beer'
import IconBookOpen from '~icons/lucide/book-open'
import IconCode from '~icons/lucide/code'
import IconGlobe from '~icons/lucide/globe'
import IconPenTool from '~icons/lucide/pen-tool'
import IconTerminal from '~icons/lucide/square-terminal'

import { LINKS } from '../content/links'
import { useLandingMessages, useLocalePath } from '../content/messages'
import ActionButton from '../ui/ActionButton.vue'
import CopyCommand from './CopyCommand.vue'

const messages = useLandingMessages()
const localePath = useLocalePath()
</script>

<template>
  <section class="landing-section">
    <h2>{{ messages.download.others.title }}</h2>
    <dl class="landing-facts ways">
      <div class="way">
        <IconBeer class="icon" aria-hidden="true" />
        <dt>{{ messages.download.others.homebrew.title }}</dt>
        <dd>{{ messages.download.others.homebrew.detail }}</dd>
        <dd class="action"><CopyCommand command="brew install --cask openpencil" /></dd>
      </div>
      <div class="way">
        <IconGlobe class="icon" aria-hidden="true" />
        <dt>{{ messages.download.others.web.title }}</dt>
        <dd>{{ messages.download.others.web.detail }}</dd>
        <dd class="action">
          <ActionButton :href="LINKS.app" :icon="IconPenTool" small>
            {{ messages.download.others.web.action }}
          </ActionButton>
        </dd>
      </div>
      <div class="way">
        <IconTerminal class="icon" aria-hidden="true" />
        <dt>{{ messages.download.others.cli.title }}</dt>
        <dd>{{ messages.download.others.cli.detail }}</dd>
        <dd class="action"><CopyCommand command="npm install -g @open-pencil/cli" /></dd>
      </div>
      <div class="way">
        <IconCode class="icon" aria-hidden="true" />
        <dt>{{ messages.download.others.source.title }}</dt>
        <dd>{{ messages.download.others.source.detail }}</dd>
        <dd class="action">
          <ActionButton
            :href="localePath('/getting-started') + '#building-from-source'"
            :icon="IconBookOpen"
            small
          >
            {{ messages.download.others.source.action }}
          </ActionButton>
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
/* Two by two, so each command fits on its line. */
.ways {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 48px 64px;
}

/* Each way ends in its action, lined up along the row whatever the text's length. */
.way {
  display: flex;
  flex-direction: column;
}

.action {
  margin-top: auto;
  padding-top: 16px;
}

@media (max-width: 860px) {
  .ways {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
