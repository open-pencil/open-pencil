# Maintaining

This file is for maintainers: work that needs write access to the repository. Everything in `CONTRIBUTING.md` applies too; releases are in `tools/AGENTS.md` (Releases).

## Pull requests from forks

- Runs for a pull request from a fork wait as `action_required` after every push. Approve one run per workflow (`gh api -X POST repos/open-pencil/open-pencil/actions/runs/<id>/approve`): approving two runs of one workflow for the same head makes one cancel the other, and the cancelled required check blocks the merge until it is rerun. A run still `queued` long after newer runs started is orphaned; cancel it and rerun it. Before calling a fork's checks green, check that `CI result` is in the rollup at all.
- GitHub refuses maintainer pushes to a fork owned by an organization, even when `maintainerCanModify` reports `true`; check `gh api repos/<owner>/<repo> --jq .owner.type` before planning follow-up commits there.
- Pushing to a fork's URL instead of a named remote makes the LFS pre-push hook check and re-upload LFS objects from history, which can hang for a long time; when a push adds no LFS files, `GIT_LFS_SKIP_PUSH=1 git push` skips only the upload.
- Rerunning an older run of a pull request joins the concurrency group of the newest commit's run and cancels it; after a push, rerun only the current head's run (`.github/workflows/ci.yml`).

## Merge queue

- The merge queue squashes a pull request and adds a `Co-authored-by` trailer for every commit author. A commit authored by an AI identity, or carrying an AI tool's trailer, therefore fails the queue's Commit messages job though the pull request's own run passed; check `gh pr view <n> --json commits` before enqueuing.
- After a pull request built on another one's branch outside a stack is squash-merged, update it by replaying its own commits onto a pinned `master` commit on a temporary branch, merging that same commit into it, and taking the temporary branch's tree. Merging a newer `master` than the replay used reverts whatever landed in between.

## Stacked pull requests

A stack is a chain of pull requests: the bottom one targets `master`, each one above targets the branch below. Every layer is a branch of this repository, so stacks need write access. CI and branch protection treat every layer as targeting `master`.

- Manage stacks with [`gh stack`](https://github.com/github/gh-stack) (`init`, `add`, `submit`, `sync`; add `--remote origin` with several remotes); a stacked pull request's base cannot be edited.
- Keep it linear: when `master` or a lower branch moves, rebase the layers (`gh stack rebase` or the pull request's Rebase button) and push with `--force-with-lease`. Merging `master` in blocks the stack from merging.
- Merge from the top layer through the merge queue, in the UI or with `gh api -X PUT repos/{owner}/{repo}/pulls/<n>/merge-async -f merge_action=merge_queue`; it lands every layer below too. `gh pr merge` and auto-merge are unavailable for stacks; `gh stack merge <pr> --yes` enqueues a layer and every layer below it.
- Open a pull request on top of another one only through `gh stack`: a plain `--base <branch>` pull request gets neither the full CI nor a CodeRabbit review.
- `gh stack submit` opens new layers as drafts, which CodeRabbit does not review; mark each one ready with `gh pr ready <n>`.
- A stack push starts two runs for each upper layer and cancels one. A cancelled twin usually does not block, but if its `CI result` job still ran and failed, the layer shows as blocked: rerun that one run.

## CodeRabbit

- CodeRabbit does not come back to a pull request it skipped while rate limited. Check capacity with `@coderabbitai rate limit` before asking for a review with `@coderabbitai review`.
