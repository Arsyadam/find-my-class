# Google Sheet + Apps Script setup

Spreadsheet SoT: [GRC Winter + Spring 2027 classes + RMP](https://docs.google.com/spreadsheets/d/13iJQzRF4nPt-ri33CZkkJs57YtpEzpR3nh8CMverTjw/edit)

ID: `13iJQzRF4nPt-ri33CZkkJs57YtpEzpR3nh8CMverTjw`

Term tabs are **denormalized** (ctcLink + RMP on each row). Apps Script is a **read-only JSON bridge** — no SyncSections / SyncRmp / Rankings rebuild.

## Tabs

| Term code | Tab name |
|-----------|----------|
| `2271` | Winter 2027 |
| `2273` | Spring 2027 |

### Expected headers (Winter / Spring)

`Term, Term code, Subject, Course, Title, Section, Class #, Component, Instruction mode, Credits, Session, Start, End, Days, Times, Location / room, Campus, Status, Seats open, Capacity, Enrolled, Waitlist, Waitlist cap, Course attributes…, Instructor(s) (ctcLink), Staff/TBA?, RMP match, Match confidence, Match note, RMP overall, RMP difficulty, RMP would take again %, RMP # ratings, RMP this-course quality/difficulty/WTA/#, RMP URL, Likely instructor (inferred, NOT confirmed), Inference basis, Inferred #1 RMP…, ctcLink class details link, Details link check`

### Column → API field (highlights)

| Sheet column | JSON field |
|--------------|------------|
| Term code | `term_code` |
| Course | `course_code` |
| Class # | `class_nbr` |
| Days / Times | `days`, `start_time`, `end_time`, `times_raw` |
| Instructor(s) (ctcLink) | `instructor` |
| Staff/TBA? | `staff_tba` |
| RMP * | `rmp_*` / `rmp_course_*` |
| Likely instructor… | `inferred_instructor` (never confirmed) |
| ctcLink class details link | `enroll_url` |

**Caveats:** `Times` may be multi-meeting (`8:00 AM-9:25 AM; 8:00 AM-9:50 AM`) — API exposes the first range as `start_time`/`end_time` plus `times_raw`. Days use `MoWe` / `TuTh` (and `;`-separated meeting patterns). `ARR` is treated like TBA for scheduling.

## Deploy Apps Script

Paste-ready single file: [`docs/apps-script-paste.gs`](./docs/apps-script-paste.gs) (also under the Project store `docs/`).

Or clasp:

```bash
cd apps-script
npm i -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json
# set scriptId after creating a bound Apps Script project on the NEW spreadsheet
clasp push
clasp deploy --description "Find My Class API"
```

### Web app settings
- Execute as: Me
- Who has access: Anyone (or Anyone with Google account)
- Optional: Project Settings → Script properties → `SHEETS_API_TOKEN`

### Planner menu
Reload the sheet → **Planner** → **Clear API cache** (entries also expire ~10 minutes). Sync/Rankings menu items are harmless stubs.

## API contract

`GET {WEB_APP_URL}?term=2271&courses=ENGL%20128,CHEM%26%20161&token=...`

Env for Next.js: **`SHEETS_API_URL` only** (optional `SHEETS_API_TOKEN` if you set the script property).

If `SHEETS_API_URL` is unset **or** Apps Script fails (HTML login page / token / timeout), Next.js automatically reads the public sheet CSV export for Winter/Spring tabs — so recommendations still work without a working web-app deploy.

```json
{
  "term": "2271",
  "courses": ["ENGL 128"],
  "tab": "Winter 2027",
  "sections": [
    {
      "term_code": "2271",
      "course_code": "ENGL 128",
      "class_nbr": "10010",
      "instructor": "Patrick Milian",
      "staff_tba": false,
      "rmp_confirmed": true,
      "rmp_overall": 4.8,
      "rmp_difficulty": 2.2,
      "rmp_would_take_again": 90,
      "rmp_course_quality": 4.89,
      "enroll_url": "https://csprd.ctclink.us/psc/csprd/EMPLOYEE/SA/s/WEBLIB_HCX_CM.H_CLASS_DETAILS.FieldFormula.IScript_Main?institution=WA100&x_term=2271&class_nbr=10010",
      "inferred_instructor": ""
    }
  ],
  "cachedAt": "...",
  "source": "live"
}
```

Staff/TBA rows may include `inferred_instructor` + `inferred_rmp_*` for display only. Ranking prefers confirmed RMP matches; inferred never counts as confirmed.

`CacheService` caches responses ~10 minutes (`fmc2:` keys).

## ctcLink notes

- Details / enroll pattern: `…H_CLASS_DETAILS…?institution=WA100&x_term={term}&class_nbr={class_nbr}`
- Terms: `2271` Winter 2027, `2273` Spring 2027
