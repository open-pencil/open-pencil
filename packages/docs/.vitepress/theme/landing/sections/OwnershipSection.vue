<script setup lang="ts">
import { useLandingMessages } from '../content/messages'

const messages = useLandingMessages()
</script>

<template>
  <section class="landing-section">
    <h2>{{ messages.ownership.title }}</h2>
    <dl class="landing-facts">
      <div v-for="item in messages.ownership.items" :key="item.title">
        <dt>{{ item.title }}</dt>
        <dd>{{ item.detail }}</dd>
      </div>
    </dl>
  </section>
</template>
