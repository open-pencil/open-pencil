<script setup lang="ts">
import IconCheck from '~icons/lucide/check'

import { creditPackRows, modelRows, planCards, searchCredits } from './pricing'
import { data as pricing } from './pricing.data'

import '../landing.css'

// Every number comes from the hosted service's configuration when the site is built
// (`pricing.data.ts`); the page itself sets none.
const plans = planCards(pricing)
const packs = creditPackRows(pricing.catalog)
const models = modelRows(pricing.services)
const search = searchCredits(pricing.services)
</script>

<template>
  <div class="landing pricing-page">
    <section class="landing-section hero">
      <span class="landing-badge">OpenPencil Cloud</span>
      <h1>Plans and pricing</h1>
      <p class="lede">
        The editor is free and open source, with or without an account. A Cloud plan keeps your
        documents on the hosted service, shares them, and pays for AI in the editor.
      </p>
    </section>

    <section class="landing-section">
      <div class="plans">
        <article v-for="plan in plans" :key="plan.id" class="plan">
          <h2>{{ plan.name }}</h2>
          <p class="price">
            <span class="amount">{{ plan.price }}</span>
            <span class="period">a month</span>
          </p>
          <dl class="limits">
            <div>
              <dt>Storage</dt>
              <dd>{{ plan.storage }}</dd>
            </div>
            <div>
              <dt>Credits each month</dt>
              <dd>{{ plan.credits ?? 'Not included' }}</dd>
            </div>
          </dl>
          <ul class="includes">
            <li v-for="item in plan.includes" :key="item">
              <IconCheck class="icon" aria-hidden="true" />{{ item }}
            </li>
          </ul>
        </article>
      </div>
      <p v-if="pricing.catalog" class="note">
        Billed monthly in US dollars, plus tax where it applies. Cancel anytime; your files stay,
        read-only beyond the free storage.
      </p>
      <p v-else class="note">Paid plans open with OpenPencil Cloud.</p>
    </section>

    <section v-if="packs.length > 0" class="landing-section">
      <header class="section-header">
        <h2>More credits</h2>
      </header>
      <p class="section-lede">
        On a paid plan, buy credits once for AI and search beyond your monthly credits. They stay
        when a plan ends.
      </p>
      <table class="rates">
        <thead>
          <tr>
            <th scope="col">Credits</th>
            <th scope="col">Price</th>
            <th scope="col">Valid for</th>
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

    <section v-if="models.length > 0" class="landing-section">
      <header class="section-header">
        <h2>What credits buy</h2>
      </header>
      <p class="section-lede">
        A request costs the tokens it reads and writes, at its model's price.
        <template v-if="search">A web search costs {{ search }} credits.</template>
      </p>
      <table class="rates">
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Credits per million input tokens</th>
            <th scope="col">Credits per million output tokens</th>
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

    <section class="landing-section">
      <p class="note">
        A server your team runs itself sets its own plans and limits; see the
        <a href="/cloud/self-hosting/">self-hosting guide</a>.
      </p>
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
