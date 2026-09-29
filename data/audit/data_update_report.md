# Data Migration Report

Generated: 2026-09-29T12:43:54.257Z

## Summary

| Metric | Value |
|--------|-------|
| Source Records | 41206 |
| Output Cutoff Records | 175049 |
| Records Rejected | 0 |
| Unique Colleges | 2165 |
| Unique Course Types | DNB, Diploma, MCh, MD, MS, Master |
| Unique Specialties | 69 |
| Unique Quotas | 79 |
| Unique States | 35 |
| Years | 2024, 2025 |

## College Type Distribution

| Type | Count |
|------|-------|
| Government | 1180 |
| DNB Hospital | 770 |
| Private | 138 |
| Deemed University | 54 |
| Central University | 23 |

## Course Type Distribution

| Type | Count |
|------|-------|
| MD | 95605 |
| MS | 45018 |
| DNB | 21463 |
| Diploma | 12926 |
| Master | 27 |
| MCh | 10 |

## Year Distribution

| Year | Records |
|------|---------|
| 2024 | 79272 |
| 2025 | 95777 |

## Validation

| Check | Result |
|-------|--------|
| JSON Validity | PASS |
| Foreign Keys | PASS |
| College Uniqueness | PASS |
| Course Validity | PASS |
| College Type Validity | PASS |
| State Validity | PASS |
| Rank Validity | PASS |

## Ambiguous Classifications

0 colleges required re-evaluation. See `college_classification_review.json` for details.

## Rejection Reasons

None
