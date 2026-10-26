# Find My Class

Unofficial Green River College (Auburn, WA) helper: upload an **Educational Plan PDF**, set schedule preferences, and get **ranked 1st / 2nd / 3rd section & professor options** for the target quarter — plus a **conflict-free weekly schedule** with 2nd/3rd fallbacks.

> **Disclaimer:** Not affiliated with Green River College, ctcLink, the Washington SBCTC, or RateMyProfessors. Always verify sections in ctcLink before enrolling.

## Architecture

```mermaid
flowchart LR
  Student[Student browser]
  Next[Next.js on Docker/VPS]
  GAS[Apps Script doGet]
  Sheet[Google Sheet SoT]
  CTC[ctcLink ClassSearch]
  RMP[RateMyProfessors]

  Student -->|Edplan PDF + prefs| Next
  Next -->|SHEETS_API_URL ~10m revalidate| GAS
  GAS --> Sheet
  CTC -->|SyncSections upsert| Sheet
  RMP -->|SyncRmp| Sheet
  Sheet -->|RecomputeRankings| Sheet
```

- **Spreadsheet** is the system of record ([live sheet](https://docs.google.com/spreadsheets/d/1bvZht035ZNWhicZw5ozdQ9LzbCvJ95H0ynaGMxQqf1g/edit)).
- **Apps Script** syncs ctcLink + RMP and exposes cached JSON via `doGet`.
- **Next.js** never scrapes ctcLink/RMP in production; it re-ranks sheet `Rankings` with the student’s preferences.

## Quick start

```bash
npm install
npm run fixtures:edplan
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without `SHEETS_API_URL`, recommendations use `fixtures/sheets-api-*.json`.

```bash
cp .env.example .env.local
# set SHEETS_API_URL after deploying Apps Script — see SHEETS_SETUP.md
```

## Key paths

| Path | Role |
|------|------|
| `src/lib/edplan/` | PDF MIME + `%PDF` validation; AcroForm parse (`Class Title ie ENGL 101Row{row}_{col}`); course normalize |
| `src/lib/ranking/` | Preference re-rank, conflicts, schedule fallback |
| `src/lib/sheets/` | Typed Apps Script client + fixture fallback |
| `src/components/PlannerApp.tsx` | Upload → editable plan → prefs → results UI |
| `apps-script/` | clasp-ready SyncSections / SyncRmp / RecomputeRankings / doGet |
| `fixtures/synthetic-edplan.pdf` | Synthetic AcroForm Edplan (no PII) |
| `fixtures/sheets-api-2271.json` | Demo Winter 2027 API payload |
| `SHEETS_SETUP.md` | Bind sheet, deploy web app, triggers |
| `DEPLOY.md` | Docker + Caddy / VPS |

## Parser acceptance (Publisher Edplan)

Verified column mapping:

| Column | Term | Expected courses |
|--------|------|------------------|
| `_3` | Winter 2027 (`2271`) | ENGL 128, POLS& 202, CHEM& 161, ENGR 100 |
| `_4` | Spring 2027 (`2273`) | MATH& 152, CHEM& 162, PHYS& 221, ENGR 106 |

Codes normalize to ctcLink form (`MATH& 152`). Placeholders like `Humanities/Social Science` or bare `IP 1` are flagged **needs choice**. PDFs are processed **in memory only**.

## Tests

```bash
npm test
npm run build
```

Coverage includes: image rejection, synthetic PDF parse, `instructor_override` precedence, conflicts, schedule fallback, preference scoring.

## Docker

```bash
docker compose up -d --build
```

See [DEPLOY.md](./DEPLOY.md). Image uses Next `output: "standalone"`.

## What works vs mocked / limited

| Piece | Status |
|-------|--------|
| Edplan PDF validate + AcroForm parse | Works (synthetic fixture in CI; real sample verified locally, never committed) |
| Preference re-rank + conflict schedule | Works against sheet JSON or fixtures |
| UI (upload → edit → results + links) | Works |
| Apps Script source in repo | Complete; **deploy is manual** by sheet owner |
| Live ctcLink sync | Implemented best-effort (cookie + JSON shape may need tweaks per term) |
| Live RMP GraphQL | Best-effort; Aliases + manual `instructor_override` are the reliable path |
| Enroll deep links | Stored URL + `class_nbr`; ctcLink often still requires login |
| Positional pdfjs fallback | Stubbed warning only when AcroForm missing — Publisher forms are the supported path |
| Docker build on this authoring machine | Docker CLI may be unavailable; Dockerfile is provided for CI/VPS |

## Privacy

- Do **not** commit real student Edplans or IDs.
- `.gitignore` blocks `*edplan*.pdf` except `fixtures/synthetic-edplan.pdf`.
