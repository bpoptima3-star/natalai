name: Blog Agent

on:
  schedule:
    - cron: '0 */8 * * *'      # every 8 hours
  workflow_dispatch:            # manual "Run workflow" button

permissions:
  contents: write               # lets the action push commits

concurrency:
  group: blog-agent
  cancel-in-progress: false     # don't let two runs collide

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Run blog agent
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: node scripts/blog-agent.js

      - name: Commit & push
        run: |
          git config user.name "NatalAI Blog Agent"
          git config user.email "actions@github.com"
          git add -A
          git commit -m "Blog: new article + sitemap $(date '+%Y-%m-%d %H:%M')" || { echo "nothing to commit"; exit 0; }
          git pull --rebase origin main
          git push origin main
