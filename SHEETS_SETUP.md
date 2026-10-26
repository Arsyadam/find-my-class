# Google Sheet + Apps Script setup

Spreadsheet SoT: [GRC Class Planner Data](https://docs.google.com/spreadsheets/d/1bvZht035ZNWhicZw5ozdQ9LzbCvJ95H0ynaGMxQqf1g/edit)

**Do not rename or drop existing columns.** You may **add** columns (this project adds `removed` on `Sections` if missing).

## Tabs (expected headers)

### Sections
`term_code,term,subject,catalog_nbr,course_code,title,section,class_nbr,component,instruction_mode,credits,days,start_time,end_time,location,status,seats_open,capacity,waitlist,instructor_ctclink,instructor_override,effective_instructor,enroll_url,last_synced` (+ optional `removed`)

Rules:
- Never overwrite `instructor_override`
- `effective_instructor = instructor_override || instructor_ctclink`

### Professors
`name,rmp_id,rmp_url,rating,difficulty,would_take_again,num_ratings,department,last_synced`

### CourseStats
`course_code,professor,rmp_id,rmp_url,course_quality,course_difficulty,course_would_take_again_pct,course_num_ratings,overall_rating,overall_difficulty,overall_would_take_again_pct,overall_num_ratings,last_review_date`

### Aliases
`ctclink_name,rmp_name,rmp_id,note` — use for Last,First ↔ First Last. **No private FRIEND dictionary.**

### Rankings
`term_code,course_code,rank,rank_label,class_nbr,section,professor,score,reason,enroll_url,rmp_url,computed_at`

## clasp deploy

```bash
cd apps-script
npm i -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json
# set scriptId after creating a bound Apps Script project on the spreadsheet
clasp push
clasp deploy --description "Find My Class API"
```

Or: Extensions → Apps Script in the sheet, paste the `.gs` files, then **Deploy → New deployment → Web app**.

### Web app settings
- Execute as: Me
- Who has access: Anyone (or Anyone with Google account) — your choice
- Optional: Project Settings → Script properties → `SHEETS_API_TOKEN`

### Planner menu + triggers
1. Reload the spreadsheet → **Planner** menu appears (`onOpen`).
2. Run **Sync sections**, **Sync RateMyProfessors**, **Recompute rankings**.
3. Triggers (clock): daily/hourly `SyncSections`, less frequent `SyncRmp`, then `RecomputeRankings`.

## API contract

`GET {WEB_APP_URL}?term=2271&courses=ENGL%20128,CHEM%26%20161&token=...`

Returns JSON:

```json
{
  "term": "2271",
  "sections": [],
  "professors": [],
  "courseStats": [],
  "rankings": [],
  "cachedAt": "...",
  "source": "live"
}
```

`CacheService` caches responses ~10 minutes.

## ctcLink + RMP notes

- ClassSearch: `IScript_ClassSearch?institution=WA100&term=&subject=&page=`
- Terms: `2271` Winter 2027, `2273` Spring 2027
- First request may need a session cookie (handled best-effort in `SyncSections`)
- RMP school id: `U2Nob29sLTIxMjM=` / legacy `2123`
- GraphQL/HTML shapes change; treat SyncRmp as best-effort and keep manual overrides via Aliases + `instructor_override`
