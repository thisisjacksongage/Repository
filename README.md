# MoneyTrack

MoneyTrack is a personal web app for tracking savings goals and the real profit from thrifted items sold on Depop, eBay, or other marketplaces. It stores data in PostgreSQL and keeps each signed-in account's records separate.

## Features

- Savings goals with dated contributions and progress tracking
- Resale inventory with purchase price, listing price, marketplace fees, payment fees, shipping, and other costs
- Net profit and monthly sales summaries
- JSON export and restore from the dashboard
- Clerk sign-in

## Run locally

This repository is a pnpm workspace. Install Node.js and pnpm, then run:

```sh
pnpm install
```

Configure these values in your local environment (do not commit real credentials):

- `DATABASE_URL` — PostgreSQL connection string
- `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY` — Clerk server keys
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for the web app

Create the development tables and start the API and web app in separate terminals:

```sh
pnpm --filter @workspace/db run push
PORT=8080 pnpm --filter @workspace/api-server run dev
PORT=23520 BASE_PATH=/ pnpm --filter @workspace/moneytrack run dev
```

The web app is served at the Vite URL shown in the terminal. Keep API and Clerk credentials in your hosting provider's secret manager or an untracked local environment file.

## Backups

Export and restore are available on the signed-in dashboard. Restoring replaces the current account's goals, contributions, and resale items after confirmation. The original browser-only MoneyTrack JSON backup format is also accepted; it migrates saved goal balances and Depop sales. Its general income and spending entries are not imported.

## Workspace layout

- `artifacts/moneytrack` — React and Vite web app
- `artifacts/api-server` — Express API and Clerk middleware
- `lib/api-spec` — OpenAPI source and generated API types
- `lib/db` — Drizzle schema and database package