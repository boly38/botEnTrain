name: botentrain-audit

on:
  schedule:
    - cron: '0 10 * * *'
  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

jobs:
  scan:
    name: npm audit
    runs-on: ubuntu-latest

    strategy:
      matrix:
        # See supported Node.js release schedule at https://nodejs.org/en/about/releases/
        node-version: [16.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: |
            package-lock.json

      - name: Install dependencies
        # - run: npm ci # need package.json.lock
        run: |
          echo "install"
          npm install
          echo "show outdated (if any)"
          npm outdated --depth=3 || echo "you must think about update your dependencies :)"

      - name: Npm audit
        uses: oke-py/npm-audit-action@v2
        with:
          audit_level: moderate
          github_token: ${{ secrets.GITHUB_TOKEN }}
          dedupe_issues: true