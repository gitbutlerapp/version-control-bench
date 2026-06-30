# Results site

A static page that explores the latest version-control-bench results — how `git`,
GitButler (`but+skill`), and Jujutsu (`jj+skill`) compare when coding agents do
version-control chores. Built with Next.js (static export), deployed on Vercel.

The page leads with the answer, lets a skeptic drill into the five scenarios and
the methodology, and is built so the honesty rules can't be edited away by
accident (the data layer never emits a cross-agent KB series, correctness is a
precomputed gate, GitButler's own failures are listed first).

## Data

The page renders one committed file: [`data/results.json`](data/results.json).
It is derived from the two raw benchmark snapshots (which live under the
gitignored `tmp/`) by [`scripts/build-web-data.mjs`](../scripts/build-web-data.mjs).
The build never touches `tmp/` — only the committed JSON.

### Refresh after a new benchmark batch

```bash
# from the repo root — edit the two source paths at the top of the script if the
# batch dir names changed, or pass them as flags:
npm run web:data
#   node scripts/build-web-data.mjs --baseline <git+but aggregate.json> --jj <jj aggregate.json>
```

Then commit `web/data/results.json`. The footer stamps `generated_at` and the
batch names, so staleness is visible on the page. The script validates the
shape (150 rows, 9 overall cells, 142/150 passed) and fails loudly if a source
snapshot is missing.

## Develop

```bash
cd web
npm install
npm run dev      # http://localhost:3000
npm run build    # static export to web/out/
```

## Deploy on Vercel

This app lives in the `web/` subdirectory of the benchmark repo.

1. New Project → import `gitbutlerapp/version-control-bench`.
2. Set **Root Directory** to `web`. Framework auto-detects as Next.js; build is
   `next build`, output is `out/` (static export — no serverless functions, runs
   on the free tier).
3. Every push to the production branch redeploys; PRs get preview URLs.

Because `web/data/results.json` is committed, the build is reproducible from the
repo alone and never needs the gitignored `tmp/` snapshots.
