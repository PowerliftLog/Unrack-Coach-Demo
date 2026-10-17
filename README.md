# UNRACK Coach — interactive showcase

**[Try the live demo](https://powerliftlog.github.io/Unrack-Coach-Demo/)** · Built by [Joseph McGannon](https://github.com/PowerliftLog)

A strength-coaching workspace for building programs, managing athletes and turning
training prescriptions into structured workouts. This public showcase runs the
current Coach interface with fictional athletes and browser-local storage.

![The UNRACK Coach workout builder](https://powerliftlog.github.io/Unrack-Coach-Demo/demo-workspace.png)

## Try it

1. Select **Maya Chen** to inspect a four-week strength program.
2. Open **Workout builder**. Explore the day/week views, edit prescriptions, and save.
3. Browse the other fictional athletes and program templates.
4. Refresh to keep local edits; choose **Reset demo** to restore the samples.

Use a desktop or laptop for program authoring. No signup or API keys are required.
Demo edits are stored only in your browser; avoid entering personal information.
Publication review is available; final publishing and delivery are not simulated. The local adapter is simplified and does not reproduce
every production capability or guarantee server validation, concurrency behavior,
authentication, email delivery or athlete sync. Unsupported paths may display a
message rather than complete an operation.

## Engineering

The interface uses React 19, TypeScript and Vite. Shared production components
cover athlete management, structured workout editing, program calendars,
template reuse and publication review. An injected local API adapter separates
those components from the private product's authenticated services.

The full product also includes a PostgreSQL/Supabase data layer, a Cloudflare
Worker, an athlete PWA and a SwiftUI companion. Those services and their source,
credentials, operational records and athlete data are outside this showcase.
This repository is a curated export with fresh history, maintained alongside the
private product. `SHOWCASE_VERSION.json` records the source revision and file
hashes; public updates pass build, export-safety and browser smoke checks.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run preview
npx playwright install chromium
npm run test:smoke
```

GitHub Actions builds and deploys the static app to GitHub Pages on pushes to
`main`. No production backend or repository secrets are needed.

## Project status and use

This is an actively developed product showcase. It is not a hosted coaching
service or a production account. Coaches interested in the product can start a
conversation through the [GitHub project discussions](https://github.com/PowerliftLog/Unrack-Coach-Demo/discussions).

Source is published for portfolio review. No open-source license is granted for
UNRACK's original code or branding; all rights are reserved. Third-party components
retain their respective licenses; see `THIRD_PARTY_NOTICES.md` and package metadata.
