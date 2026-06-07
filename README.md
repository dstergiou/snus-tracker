# Snus Tracker

Personal PWA for tracking snus pouch usage. Built with SvelteKit, stores all data locally on the device via IndexedDB. No backend, no analytics, no account.

## Features

- Three (configurable) products on the home screen, each with a **Start / Stop** button
- Live elapsed timer while a session is active
- Only one session active at a time (starting product B auto-stops A)
- 30-minute auto-stop guard against forgotten stops
- **History** view with day / week / month aggregates and per-product breakdowns
- Edit or delete past sessions
- Manage products (add / edit / remove) with cost-per-pouch and nicotine mg
- Cost snapshotted onto each session at the time it's logged — editing a product's price never rewrites history
- "Today" snapshot on the home screen (pouches, spent, average gap)
- Export / import JSON backup; backup-staleness reminder on Settings
- Installable on iOS via Safari → Share → Add to Home Screen
- Offline-capable (service worker caches the app shell)

## Stack

- [SvelteKit](https://svelte.dev/docs/kit) with [`adapter-static`](https://svelte.dev/docs/kit/adapter-static) (SPA fallback)
- [Dexie](https://dexie.org/) on top of IndexedDB
- Plain CSS, dark theme

## Develop

```sh
npm install
npm run dev
```

Open http://localhost:5173.

## Build

```sh
npm run build      # writes static output to ./build
npm run preview    # serves the production build locally
```

## Icons

The app icon lives at `static/icon.svg`. PNG variants (180/192/512) are generated from it:

```sh
node scripts/gen-icons.mjs
```

Re-run after editing the SVG.

## Seed data

`products.json` in the repo root is auto-loaded the first time the app runs on a fresh device (when the products table is empty). Edit this file to change the initial product list.

## Deploy

Any static host works. The build output is in `./build`. iOS requires HTTPS for "Add to Home Screen", so localhost / file:// won't install.

## Install on iPhone

1. Open the deployed URL in Safari
2. Tap the Share button
3. Tap **Add to Home Screen**
4. Tap **Add**

The app then launches standalone, runs offline, and stores data locally.

## Data safety

Everything is stored in the browser's IndexedDB. **Export regularly from Settings.** If you wipe Safari data, uninstall the home-screen app, or switch phones without importing first, the data is gone.

There's one quirk worth knowing: the IndexedDB database is named `snuss-tracker` (with double `s`) for historical reasons. Renaming it would orphan existing data. See `src/lib/db.ts`.
