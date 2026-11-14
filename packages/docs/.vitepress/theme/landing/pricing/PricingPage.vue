<script setup lang="ts">
import { useData } from 'vitepress'
import IconCheck from '~icons/lucide/check'

import { useLocalePath, type LandingMessages } from '../content/messages'
import { creditPackRows, modelRows, planCards, searchPrice } from './pricing'
import { data as pricing } from './pricing.data'

import '../landing.css'

/** The copy of the page's locale, imported by that locale's `cloud/pricing.md`. */
const { messages } = defineProps<{ messages: LandingMessages }>()
const { lang } = useData()
const localePath = useLocalePath()

// Every number comes from the hosted service's configuration when the site is built
// (`pricing.data.ts`); the page itself sets none.
const copy = messages.pricing
const plans = planCards(pricing, copy, lang.value)
const packs = creditPackRows(pricing.catalog, lang.value)
const models = modelRows(pricing.services, lang.value)
const search = searchPrice(pricing.services, copy, lang.value)
const sellsPlans = (pricing.catalog?.plans.length ?? 0) > 0
// `{link}` becomes a link to the self-hosting guide, which exists only in English.
const [selfHostingBefore, selfHostingAfter] = copy.selfHosting.split('{link}')
</script>

<template>
  <div class="landing pricing-page">
    <section class="landing-section hero">
      <span class="landing-badge">{{ copy.badge }}</span>
      <h1>{{ copy.title }}</h1>
      <p class="lede">{{ copy.lede }}</p>
      <div class="plans">
        <article v-for="plan in plans" :key="plan.id" class="plan">
          <h2>{{ plan.name }}</h2>
          <p class="price">
            <span class="amount">{{ plan.price }}</span>
            <span class="period">{{ copy.perMonth }}</span>
          </p>
          <dl class="limits">
            <div>
              <dt>{{ copy.storage }}</dt>
              <dd>{{ plan.storage }}</dd>
            </div>
            <div>
              <dt>{{ copy.credits }}</dt>
              <dd>{{ plan.credits ?? copy.noCredits }}</dd>
            </div>
          </dl>
          <ul class="includes">
            <li v-for="item in plan.includes" :key="item">
              <IconCheck class="icon" aria-hidden="true" />{{ item }}
            </li>
          </ul>
        </article>
      </div>
      <p class="note">{{ sellsPlans ? copy.billed : copy.paidSoon }}</p>
      <p class="note">
        {{ selfHostingBefore
        }}<a :href="localePath('/cloud/self-hosting/', { translated: false })">{{
          copy.selfHostingLink
        }}</a
        >{{ selfHostingAfter }}
      </p>
    </section>

    <section v-if="packs.length > 0" class="landing-section">
      <header class="section-header">
        <h2>{{ copy.packs.title }}</h2>
      </header>
      <p class="section-lede">{{ copy.packs.lede }}</p>
      <table class="rates">
        <thead>
          <tr>
            <th scope="col">{{ copy.packs.credits }}</th>
            <th scope="col">{{ copy.packs.price }}</th>
            <th scope="col">{{ copy.packs.validFor }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pack in packs" :key="pack.id">
            <td>{{ pack.credits }}</td>
            <td>{{ pack.price }}</td>
            <td>{{ pack.validity }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section v-if="models.length > 0 || search" class="landing-section">
      <header class="section-header">
        <h2>{{ copy.rates.title }}</h2>
      </header>
      <p class="section-lede">
        {{ copy.rates.lede }}
        <template v-if="search">{{ search }}</template>
      </p>
      <table v-if="models.length > 0" class="rates">
        <thead>
          <tr>
            <th scope="col">{{ copy.rates.model }}</th>
            <th scope="col">{{ copy.rates.input }}</th>
            <th scope="col">{{ copy.rates.output }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="model in models" :key="model.label">
            <td>{{ model.label }}</td>
            <td>{{ model.input }}</td>
            <td>{{ model.output }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.hero {
  padding-top: 72px;
}

h1 {
  margin-top: 16px;
  font-size: clamp(36px, 5vw, 56px);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.05;
}

.lede,
.section-lede {
  max-width: 640px;
  margin-top: 16px;
  color: var(--vp-c-text-2);
  font-size: 17px;
  line-height: 1.6;
}

.plans {
  display: grid;
  margin-top: 48px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 360px));
  gap: 24px;
}

.plan {
  padding: 28px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  background: var(--vp-c-bg-soft);
}

.plan h2 {
  font-size: 20px;
  font-weight: 600;
}

.price {
  display: flex;
  gap: 8px;
  align-items: baseline;
  margin-top: 12px;
}

.amount {
  font-size: 40px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.period,
.limits dt {
  color: var(--vp-c-text-2);
}

.limits {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}

.limits div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.limits dd {
  font-weight: 600;
}

.includes {
  display: grid;
  gap: 8px;
  margin-top: 20px;
  padding: 0;
  list-style: none;
}

.includes li {
  display: flex;
  gap: 8px;
  align-items: center;
}

.includes .icon {
  flex: none;
  width: 16px;
  height: 16px;
  color: var(--vp-c-brand-1);
}

.note {
  margin-top: 20px;
  color: var(--vp-c-text-2);
}

.rates {
  display: table;
  width: 100%;
  margin-top: 24px;
  border-collapse: collapse;
}

.rates th,
.rates td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  text-align: start;
}

.rates th {
  color: var(--vp-c-text-2);
  font-weight: 500;
}
</style>
