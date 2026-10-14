#!/usr/bin/env node
/* ============================================================
   NEET PG College Predictor — Haryana Quotas & Categories ETL Pipeline
   ============================================================
   
   Extracts, transforms, and validates Haryana cutoff data
   from the source JSON into the application target format.
   
   1. Quotas Divided by Institution & Domicile Type:
      - Government Merit Seats:
        Haryana State Quota (HAR Govt-All)
      - Institutional Preference (IP):
        Haryana State Quota - Institutional Preference (HAR Govt-Inst. Pref),
        Haryana Private Seats - Institutional Preference (Haryana Priv IP)
      - Private State Domicile:
        Haryana Private Seats - State Quota (HAR Priv-Govt Quota)
      - Private Open (Non-Domicile):
        Haryana Private Seats - Management Quota (HAR Priv-Mgmt)
      - Private Premium / NRI & Minority:
        Haryana Private Seats - NRI Quota (Haryana Priv NRI),
        Haryana Private Seats - Minority Quota (HAR Priv-Minority)
      - In-Service Cadre (DNB):
        Haryana DNB Inservice Seats (Haryana DNB Serv)
   
   2. Categories Divided by Reservation Eligibility (36 Categories):
      - General Merit: UR
      - OBC / Backward Classes: BCA (Block A), BCB (Block B)
      - Scheduled Castes: SC, SCD (Deprived SC)
      - EWS: EWS
      - In-Service Doctors: UR Service, BCA Service, BCB Service, SC Service, SCD Service
      - Institutional Preference (IP): IP-UR, IP-BCA, IP-BCB, IP-SC, IP-SCD,
        and IP In-Service: IP-UR Service, IP-BCA Service, IP-BCB Service, IP-SC Service, IP-SCD Service
      - PwD & Horizontal: UR-PH, BCB-PH, UR-PH Service, BCB-PH Service, IP-UR-PH Service,
        UR ESM FF, UR FF, UR ESM, BCA ESM, SC ESM, BCA ESM FF, IP-UR Service ESM FF
      - Private / Special Quota: MNG, NRI, MINORITY
   
   Source:  /Users/swethshaw/career plan b/datfile/harayana.json (READ-ONLY)
   Target:  /Users/swethshaw/career plan b/college_pre/data/cutoffs/Haryana.json
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// Paths configuration
// ------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.resolve(PROJECT_ROOT, '../datfile/harayana.json');
const TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/Haryana.json');
const TEMP_TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/Haryana.json.tmp');
const COLLEGES_FILE = path.resolve(PROJECT_ROOT, 'data/colleges.json');
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'data_backup/cutoffs');
const BACKUP_FILE = path.resolve(BACKUP_DIR, 'Haryana.json.bak');

// ------------------------------------------------------------
// 1. Quotas Grouped by Institution & Domicile Type
// ------------------------------------------------------------
const HARYANA_QUOTA_GROUPS = {
  'Government Merit Seats': [
    'HAR Govt-All'
  ],
  'Institutional Preference (IP)': [
    'HAR Govt-Inst. Pref',
    'Haryana Priv IP'
  ],
  'Private State Domicile': [
    'HAR Priv-Govt Quota'
  ],
  'Private Open (Non-Domicile)': [
    'HAR Priv-Mgmt'
  ],
  'Private Premium / NRI & Minority': [
    'Haryana Priv NRI',
    'HAR Priv-Minority'
  ],
  'In-Service Cadre (DNB)': [
    'Haryana DNB Serv'
  ]
};

const VALID_QUOTAS = new Set();
for (const grp in HARYANA_QUOTA_GROUPS) {
  HARYANA_QUOTA_GROUPS[grp].forEach(q => VALID_QUOTAS.add(q));
}

// ------------------------------------------------------------
// College ID Generation Function
// ------------------------------------------------------------
function generateCollegeId(state, instituteName) {
  const code = 'HR';
  let cleanName = (instituteName || '').replace(/&/g, 'and');
  cleanName = cleanName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toUpperCase();
  cleanName = cleanName.replace(/^_/, '').replace(/_$/, '');
  return `${code}_${cleanName}`;
}

function normalizeCourse(courseName) {
  if (!courseName) return { courseType: '', specialty: '' };
  const name = courseName.trim();

  if (name.startsWith('MD ')) {
    return { courseType: 'MD', specialty: name.substring(3).trim() };
  }
  if (name.startsWith('MS ')) {
    return { courseType: 'MS', specialty: name.substring(3).trim() };
  }
  if (name.startsWith('MCh ')) {
    return { courseType: 'MCh', specialty: name.substring(4).trim() };
  }
  if (name.startsWith('DNB ')) {
    return { courseType: 'DNB', specialty: name.substring(4).trim() };
  }
  if (name.startsWith('Master of ') || name.startsWith('Master ')) {
    return { courseType: 'Master', specialty: name };
  }
  if (name.startsWith('Diploma in ') || name.startsWith('Diploma ')) {
    let specialty = name.startsWith('Diploma in ') ? name.substring(11).trim() : name.substring(8).trim();
    specialty = specialty.replace(/-NBE$/i, '').trim();
    return { courseType: 'Diploma', specialty: specialty };
  }

  return { courseType: name, specialty: '' };
}

function formatRound(session, roundNum) {
  const year = parseInt(session, 10);
  if (year === 2024) {
    return `24 round ${roundNum}`;
  }
  return `Round ${roundNum}`;
}

function parseAllotments(crObj) {
  if (!crObj) return 1;

  if (typeof crObj.allotments_count === 'number' && crObj.allotments_count > 0) {
    return Math.floor(crObj.allotments_count);
  }

  if (crObj.value) {
    const match = String(crObj.value).match(/\((\d+)\)/);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }

  return 1;
}

function main() {
  console.log('====================================================');
  console.log('Starting NEET PG Haryana Cutoff ETL Extraction');
  console.log('====================================================');

  // Verify source exists
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`FATAL: Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  // Verify source read-only access
  try {
    fs.accessSync(SOURCE_FILE, fs.constants.R_OK);
    console.log(`✓ Read-only source verified: ${SOURCE_FILE}`);
  } catch (err) {
    console.error(`FATAL: Source file is not readable: ${err.message}`);
    process.exit(1);
  }

  // Load colleges map
  if (!fs.existsSync(COLLEGES_FILE)) {
    console.error(`FATAL: Colleges file not found: ${COLLEGES_FILE}`);
    process.exit(1);
  }

  const collegesData = JSON.parse(fs.readFileSync(COLLEGES_FILE, 'utf8'));
  const collegesMap = new Map();
  collegesData.forEach(c => collegesMap.set(c.id, c));
  console.log(`✓ Loaded ${collegesMap.size} colleges from colleges.json`);

  // Read raw source data
  const rawData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  console.log(`✓ Read ${rawData.length} records from source JSON`);

  const roundKeys = [
    { key: 'cr_2024_1', session: '2024', roundNum: '1' },
    { key: 'cr_2024_2', session: '2024', roundNum: '2' },
    { key: 'cr_2024_3', session: '2024', roundNum: '3' },
    { key: 'cr_2024_4', session: '2024', roundNum: '4' },
    { key: 'cr_2024_5', session: '2024', roundNum: '5' },
    { key: 'cr_2025_1', session: '2025', roundNum: '1' },
    { key: 'cr_2025_2', session: '2025', roundNum: '2' },
    { key: 'cr_2025_3', session: '2025', roundNum: '3' },
    { key: 'cr_2025_4', session: '2025', roundNum: '4' }
  ];

  const extractedCutoffs = [];
  const seenCutoffKeys = new Set();
  let duplicateCount = 0;
  let unmappedCollegesCount = 0;
  const unmappedCollegeNames = new Set();
  const categoryCounts = {};
  const quotaCounts = {};
  const quotaGroupCounts = {};
  for (const grp in HARYANA_QUOTA_GROUPS) quotaGroupCounts[grp] = 0;

  rawData.forEach(record => {
    const instName = record.institute ? record.institute.name : '';
    const collegeId = generateCollegeId('Haryana', instName);

    if (!collegesMap.has(collegeId)) {
      unmappedCollegesCount++;
      unmappedCollegeNames.add(instName);
    }

    const { courseType, specialty } = normalizeCourse(record.course ? record.course.name : '');
    const quotaCode = record.quota ? (record.quota.short_name || record.quota.name) : '';
    const seatCategory = record.category || '';

    // Track category counts
    categoryCounts[seatCategory] = (categoryCounts[seatCategory] || 0) + 1;
    quotaCounts[quotaCode] = (quotaCounts[quotaCode] || 0) + 1;

    // Track quota group counts
    for (const grp in HARYANA_QUOTA_GROUPS) {
      if (HARYANA_QUOTA_GROUPS[grp].includes(quotaCode)) {
        quotaGroupCounts[grp]++;
        break;
      }
    }

    roundKeys.forEach(rk => {
      const crObj = record[rk.key];
      if (!crObj) return;

      const closingRank = crObj.ai_rank || crObj.closing_rank;
      if (!closingRank || typeof closingRank !== 'number' || closingRank <= 0) return;

      const roundLabel = formatRound(rk.session, rk.roundNum);
      const allotmentsCount = parseAllotments(crObj);

      const feeFormatted = record.fee ? String(record.fee).trim() : null;
      let stipendFormatted = record.stipend_year_1 ? String(record.stipend_year_1).trim() : null;
      if (stipendFormatted && !stipendFormatted.endsWith('*')) {
        stipendFormatted = stipendFormatted + '*';
      }

      const dedupeKey = [
        collegeId,
        courseType,
        specialty,
        quotaCode,
        seatCategory,
        roundLabel,
        closingRank
      ].join('|');

      if (seenCutoffKeys.has(dedupeKey)) {
        duplicateCount++;
        return;
      }
      seenCutoffKeys.add(dedupeKey);

      extractedCutoffs.push({
        year: parseInt(rk.session, 10),
        authority: 'Haryana',
        counselling: 'Haryana',
        round: roundLabel,
        collegeId: collegeId,
        quotaCode: quotaCode,
        course: courseType,
        specialty: specialty,
        seatCategory: seatCategory,
        closingRank: closingRank,
        allotments_count: allotmentsCount,
        numberOfAllotments: allotmentsCount,
        fee: feeFormatted,
        stipend: stipendFormatted
      });
    });
  });

  console.log('\n--- Extraction & Transformation Statistics ---');
  console.log(`Raw rows processed:          ${rawData.length}`);
  console.log(`Extracted cutoff records:    ${extractedCutoffs.length}`);
  console.log(`Duplicates skipped:          ${duplicateCount}`);
  console.log(`Unmapped colleges:           ${unmappedCollegesCount}`);

  if (unmappedCollegesCount > 0) {
    console.error('FATAL: Found unmapped colleges:', Array.from(unmappedCollegeNames));
    process.exit(1);
  }

  // Sort cutoffs deterministically
  extractedCutoffs.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.collegeId !== b.collegeId) return a.collegeId.localeCompare(b.collegeId);
    if (a.course !== b.course) return a.course.localeCompare(b.course);
    if (a.specialty !== b.specialty) return a.specialty.localeCompare(b.specialty);
    if (a.quotaCode !== b.quotaCode) return a.quotaCode.localeCompare(b.quotaCode);
    if (a.seatCategory !== b.seatCategory) return a.seatCategory.localeCompare(b.seatCategory);
    if (a.round !== b.round) return a.round.localeCompare(b.round);
    return a.closingRank - b.closingRank;
  });

  // Verify quotas against definition
  console.log('\n--- Quotas Divided by Institution & Domicile Type ---');
  for (const grp in HARYANA_QUOTA_GROUPS) {
    const quotas = HARYANA_QUOTA_GROUPS[grp];
    const cutoffsInType = extractedCutoffs.filter(c => quotas.includes(c.quotaCode)).length;
    console.log(`  • ${grp}:`);
    quotas.forEach(q => console.log(`      - ${q}`));
    console.log(`    Total cutoffs: ${cutoffsInType}`);
  }

  const uniqueExtractedQuotas = new Set(extractedCutoffs.map(c => c.quotaCode));
  for (const q of uniqueExtractedQuotas) {
    if (!VALID_QUOTAS.has(q)) {
      console.error(`FATAL: Unexpected quota in extracted data: "${q}"`);
      process.exit(1);
    }
  }

  // Validate allotments_count on 100% of records
  let invalidAllotmentsCount = 0;
  extractedCutoffs.forEach((c, idx) => {
    if (typeof c.allotments_count !== 'number' || c.allotments_count < 1 || !Number.isInteger(c.allotments_count)) {
      invalidAllotmentsCount++;
    }
  });

  if (invalidAllotmentsCount > 0) {
    console.error(`FATAL: ${invalidAllotmentsCount} records have invalid allotments_count`);
    process.exit(1);
  }
  console.log(`✓ 100% of extracted records (${extractedCutoffs.length}) have valid positive integer allotments_count >= 1`);

  // Write to temporary target file then atomic rename
  fs.writeFileSync(TEMP_TARGET_FILE, JSON.stringify(extractedCutoffs, null, 2), 'utf8');
  fs.renameSync(TEMP_TARGET_FILE, TARGET_FILE);
  console.log(`\n✓ Successfully saved ${extractedCutoffs.length} cutoffs to:`);
  console.log(`  ${TARGET_FILE}`);

  console.log('\n====================================================');
  console.log('NEET PG Haryana ETL Pipeline Completed Successfully');
  console.log('====================================================\n');
}

if (require.main === module) {
  main();
}

module.exports = {
  HARYANA_QUOTA_GROUPS,
  generateCollegeId,
  normalizeCourse,
  parseAllotments
};
