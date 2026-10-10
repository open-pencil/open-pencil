<script setup lang="ts">
import { useLandingMessages, withCount } from '../content/messages'
import { data as stats } from '../content/stats.data'

const messages = useLandingMessages()
</script>

<template>
  <div class="commands">
    <h3>{{ withCount(messages.commands.cli, stats.cliCommands.length) }}</h3>
    <ul>
      <li v-for="command in stats.cliCommands" :key="command">{{ command }}</li>
    </ul>
    <h3>{{ withCount(messages.commands.mcp, stats.mcpTools) }}</h3>
    <p>{{ messages.commands.mcpDetail }}</p>
  </div>
</template>

<style scoped>
.commands {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

h3 {
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 600;
}

h3:not(:first-child) {
  margin-top: 8px;
}

ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

li {
  padding: 2px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 20px;
}

p {
  font-size: 14px;
  line-height: 1.55;
}
</style>
