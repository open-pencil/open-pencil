---
title: Cloud AI Services
description: Run the OpenPencil services server so workspace members use AI models within their plan's monthly credits.
---

# AI Services

Cloud does not run models itself. It advertises a service and signs short-lived tokens that let workspace members use it, and the service holds each workspace's owner to the credit allowance their plan grants, shared by every workspace they own. The repository's services server is a minimal implementation of this: it forwards chat completions to one OpenAI-compatible upstream, such as OpenRouter, with your key.

1. Create a P-256 signing key, `openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256`, and pass the PEM in `OPENPENCIL_CLOUD_SERVICES_SIGNING_KEY`. Cloud refuses to start with a key it cannot sign with.
2. Add `[services] endpoint` to the Cloud TOML with the services server's address, and enable `[entitlements.services]`, optionally with a `monthly_credit_allowance`; without one, the services server does not limit spend. With entitlements from the database, set them per account with the `entitlements` command instead (`--account <user id>`); a workspace takes its owner's.
3. Copy [`openpencil-services.example.toml`](https://github.com/open-pencil/open-pencil/blob/master/packages/cloud/deploy/openpencil-services.example.toml), set `relay.cloud_url` to Cloud's `public_url`, `allowed_origins` to the browser editors, and list the models with their credit prices.
4. Start it with `OPENPENCIL_SERVICES_CONFIG`, `OPENPENCIL_SERVICES_UPSTREAM_KEY`, and `DATABASE_URL` set: `node --env-file=.env dist-standalone/services.mjs`, or `openpencil-services` from the npm package. It listens on `PORT` (default `8788`) and can share Cloud's database, keeping its own tables and migration history.

The services server charges a request once the upstream reports its usage, and admits one while the workspace owner's account has credits left, so requests already in flight can overdraw the month's allowance by what they cost; `relay.max_concurrent_requests` bounds them per account. An account's allowance, shared by every workspace it owns, renews at the start of each UTC month. The editor's chat shows how many credits are left, and once they run out it says when the allowance renews and asks members to contact you; with no `[billing]` table it offers nothing to buy. It refuses a model request larger than `relay.max_request_bytes` (16 MiB by default) before reading it all. Choose an upstream that reports token usage: a request it reports none for is logged as an error and not charged.
