# NEET PG College Predictor 2026 — MCC Counselling

A static, client-side college predictor for NEET PG 2026 candidates based on MCC (Medical Counselling Committee) counselling closing rank data.

## Purpose

Helps NEET PG candidates explore which MD, MS, Diploma and DNB colleges their All India Rank may qualify for, using historical MCC 2025 allotment data.

## Tech Stack

- **HTML** — Semantic, accessible markup with structured data (JSON-LD)
- **CSS** — Custom properties design system, responsive from 320px
- **Vanilla JavaScript** — No frameworks, no build step
- **JSON** — Static data files for filters, colleges and cutoffs

No backend, no database, no external dependencies (except Google Fonts).

## File Structure

```
college_pre/
├── index.html              # Single-page application
├── style.css               # Design system and responsive styles
├── app.js                  # Application logic
├── robots.txt              # Search engine directives
├── sitemap.xml             # Sitemap for SEO
├── README.md               # This file
├── data/
│   ├── filters.json        # Static filter definitions (categories, quotas, states, etc.)
│   ├── colleges.json       # College records with stable IDs
│   └── cutoffs-2025.json   # MCC 2025 cutoff records (sample data)
└── docs/
    ├── round 1 2025.pdf    # Source MCC allotment documents
    ├── round 2 2025.pdf
    ├── round 3 2025.pdf
    └── round 4 2025.pdf
```

## Data Model

### colleges.json

Each college has a stable ID in `{STATE}_{ABBR}_{CITY}` format:

```json
{
  "id": "TN_MMC_CHENNAI",
  "name": "Madras Medical College",
  "city": "Chennai",
  "state": "Tamil Nadu",
  "collegeType": "State Government"
}
```

### cutoffs-2025.json

Each cutoff record links to a college by `collegeId`:

```json
{
  "year": 2025,
  "counsellingAuthority": "MCC",
  "round": "Round 2",
  "collegeId": "TN_MMC_CHENNAI",
  "quotaCode": "AI",
  "course": "MD",
  "specialty": "Radio-Diagnosis",
  "seatCategory": "GN",
  "closingRank": 1500
}
```

**Data rules:**
- All records have `year: 2025` and `counsellingAuthority: "MCC"`
- Every `collegeId` exists in `colleges.json`
- No M.Ch courses (this is NEET PG, not Super Speciality)
- No State Quota codes

## Replacing Sample Data with Real Data

The current `cutoffs-2025.json` contains **sample placeholder values**. To use real data:

1. Normalise MCC allotment PDFs into the JSON schema above
2. Ensure every record has a valid `collegeId` matching an entry in `colleges.json`
3. Add new colleges to `colleges.json` as needed
4. Specialties will auto-populate from the cutoff data — no HTML changes needed

## Prediction Algorithm

The predictor uses a transparent ratio-based approach:

```
ratio = userRank / closingRank

≤ 0.85  → Strong
≤ 1.00  → Possible
≤ 1.10  → Reach
> 1.10  → Outside 2025 Range
```

These are **historical prediction bands**, not admission probabilities.

## Category Eligibility

Reserved category candidates are shown seats for both their reserved category and Open (GN) seats:

| Candidate Category | Eligible Seat Categories |
|---|---|
| GN | GN |
| EW | EW, GN |
| BC | BC, GN |
| SC | SC, GN |
| ST | ST, GN |
| GN PwD | GN PwD, GN |
| EW PwD | EW PwD, EW, GN PwD, GN |
| BC PwD | BC PwD, BC, GN PwD, GN |
| SC PwD | SC PwD, SC, GN PwD, GN |
| ST PwD | ST PwD, ST, GN PwD, GN |

## Local Development

```bash
# Serve with any static HTTP server
npx http-server -c-1

# Or use Python
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

## Disclaimer

Predictions are based only on historical MCC NEET-PG 2025 allotment data. Past closing ranks do not guarantee future admission. This website is not affiliated with or endorsed by MCC.
