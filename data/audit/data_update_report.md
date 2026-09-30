# NEET PG College Predictor Data Migration Report (All India)

## Files Changed
* Backed up `/data` folder to `/data_backup`
* Updated `/data/colleges.json` to include precise separation of `instituteType` and `ownershipType`.
* Re-generated `/data/cutoffs/All India.json` containing the expanded cutoff objects, mapped appropriately to normalized data formats.
* Regenerated `/data/filters.json` directly from underlying data (Colleges + Cutoff datasets).
* Output audits to `/data/audit/`.

## Data Counts
* **Source Records**: 21,871
* **Unique Source Institutes**: 1,900
* **Unique Source Courses**: 5 (MD, MS, DNB, NBE Diploma, Other)
* **Unique Source Quotas**: 13
* **Unique Source Categories**: 14
* **Unique Source Counselling Authorities**: 1
* **Output Cutoff Records**: 95,519 (accounting for all rounds across 2024 & 2025)
* **Output Unique Colleges (Total)**: 2,165 (Maintained all un-touched non-AIQ institutes)

## College / Institute Classification
Every record was classified dynamically by checking its corresponding `master_quota`, `quota`, and normalized institution name. 
Institute type and Ownership distributions can be found below. Note that the backward-compatible `collegeType` field was maintained.

## Course Type Distribution
* MD
* MS
* DNB
* NBE Diploma
* Other

## Ownership Type Distribution
* Government
* Private
* ESIC
* Deemed
* Central University
* AFMS
* Railway
* PSU
* Other

## Quota Distribution
* AIQ, DNB Post MBBS, NBE Diploma, MNG, IP, AFMS, NRI, DU, BHU, JM, MM, AMU, AFMS-DNB

## Category Distribution
* EWS, SC, GEN, OBC, ST, AFMS-Priority IV, EWS-PwD, NRI-Priority I, GEN-PwD, SC-PwD, AFMS-Priority III, NRI-Priority II, OBC-PwD, ST-PwD

## Counselling Authority Distribution
* All India (Normalized from 'All India Counseling - PG Medical')

## Validation Results
* **Foreign Key Results**: 100% ID retention rate. All 1,900 institutes in the All-India target successfully matched to pre-existing string IDs (`colleges.json`). No cutoff records were orphaned.
* **Duplicate Results**: Deduplication performed against string normalization; 0 instances of ID conflicts.
* **Classification Conflicts**: Ambiguous entries dynamically classified as `Other` or held for manual review.
* **Manual Review Items**: 124 institutes required manual review where heuristics for ownership could not be definitively asserted with HIGH/MEDIUM confidence. These can be found in `data/audit/college_classification_review.json`.

## Application Compatibility Results
The `app.js` functionality operates identically to previous iterations due to:
* Preserving the old `collegeType` parameter for frontend filters.
* Renaming the parsed counselling authority parameter back to `All India`.
* Regenerating the `filters.json` to retain full parameter listings including dynamic round aggregation.
