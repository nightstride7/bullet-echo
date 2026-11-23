# 🎯 Bullet Echo

**A local-first outreach CRM for Product Hunt launches.** Find a launch, score it, fire a personalized LinkedIn note, track the reply. No backend, no accounts, no API keys. Your pipeline never leaves your browser.

> Status: **v6 — public alpha.** Built for one operator's daily workflow, now open for feedback. Tell us whether to keep it or kill it → [open an issue](../../issues).

## The loop

```
PH launch → verify → score (0–100) → FIRE or KILL → personalized note + message → track reply
```

- **Scored assessments**: positioning, claims to challenge, architectural observation, opportunity angle.
- **Founder Play**: 8 filters (commercial intent, indie/early, fresh ≤14 days, founder on LinkedIn, regional signal, funding/track record, problem exists in your market). Hit 6 of 7 and the card is tagged ⚡ FP.
- **Reply toolkit**: ready replies for *interested / quiet / wrong person* plus a PH comment angle.
- **CRM panel**: pending → connected → replied, with fire log and daily streak map.

## Quick start

```bash
git clone https://github.com/<you>/bullet-echo.git
cd bullet-echo
npm install
npm run dev        # opens http://localhost:5173
```

Production build: `npm run build && npm run preview`.

## How it works

Bullet Echo is a pure front-end app. Everything is stored in `localStorage`.
Assessments are **not** generated in the app: you produce them with any LLM using [`prompts/assess.md`](prompts/assess.md), then paste the JSON into the **DATA** tab in the app (schema in [`docs/DATA-SCHEMA.md`](docs/DATA-SCHEMA.md)). This keeps the tool free to run and key-less.

## Make it yours

1. Edit [`src/config.js`](src/config.js) with your name and pitch.
2. Run `prompts/assess.md` on each launch you verify.
3. Open **DATA**, paste the JSON, hit **ADD TO PIPELINE**. Use **EXPORT JSON** to back up or share.

## Data rule

Verify launches on a PH tracker or the PH page itself — never from search snippets. Leaderboards are often flooded with promoted products. See [docs/WORKFLOW.md](docs/WORKFLOW.md).

## Roadmap

- [x] JSON import/export of the pipeline
- [x] In-app paste form for assessments (DATA tab)
- [ ] CSV import (Clay / Apollo)
- [ ] Optional bring-your-own-key assessment
- [ ] Multi-source feeds beyond Product Hunt

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Be honest in outreach: see [docs/ETHICS.md](docs/ETHICS.md).

## License

MIT © nightstride7
