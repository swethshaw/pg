#!/usr/bin/env node
/* ============================================================
   NEET PG College Predictor — Madhya Pradesh Quotas & Categories ETL Pipeline
   ============================================================
   
   Extracts, transforms, and validates Madhya Pradesh cutoff data
   from the source JSON into the application target format.
   
   1. Quotas Divided by Institution & Domicile Type:
      - Government (State Domicile):
        MP Govt Quota
      - Private (State Domicile):
        MP Private Seats - Open Quota (MP Priv-Open)
      - Non-Domicile / Open (All India):
        MP Private Seats - Non Domicile (MP Priv-NonDomicile),
        MP Govt Quota - Non Domicile (MP Govt-NonDomicile)
      - NRI Quota:
        MP Private Seats - NRI Quota (MP Priv-NRI),
        MP Private Seats - NRI Non Domicile (MP Priv-NRINonDomicil)
   
   2. Categories Divided by Reservation Eligibility:
      - Unreserved / General Merit (No Social Reservation):
        UR/X/OP, UR (Non Domicile)
      - Social Reservations (State Domicile Only):
        OBC/X/OP, SC/X/OP, ST/X/OP, EWS/X/OP
      - In-Service Medical Officers (Service Quota):
        UR/X/OP Service, OBC/X/OP Service, SC/X/OP Service, ST/X/OP Service, EWS/X/OP Service
      - Horizontal Reservations (PwD & NRI):
        UR/PH/OP, SC/PH/OP, OBC/PH/OP, ST/PH/OP, EWS/PH/OP, UR/PH/OP Service,
        UR/NRI/OP, UR/NRI (Non Domicile)
   
   Source:  /Users/swethshaw/career plan b/datfile/Madhya Pradesh.json (READ-ONLY)
   Target:  /Users/swethshaw/career plan b/college_pre/data/cutoffs/Madhya Pradesh.json
   
   Guarantees:
   - Source is treated as strictly read-only.
   - Extracts all 6 quotas across Govt, Private, Non-Domicile, and NRI.
   - Preserves all 19 reservation/category eligibility codes.
   - Computes and exposes mandatory `allotments_count` field (int >= 1).
   - Preserves `numberOfAllotments` for full backward compatibility.
   - Validates all institutes against colleges.json (0 missing).
   - Deterministic sorting and atomic file replacement.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------
// Paths configuration
// ------------------------------------------------------------
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.resolve(PROJECT_ROOT, '../datfile/Madhya Pradesh.json');
const TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/Madhya Pradesh.json');
const TEMP_TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/Madhya Pradesh.json.tmp');
const COLLEGES_FILE = path.resolve(PROJECT_ROOT, 'data/colleges.json');
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'data_backup/cutoffs');
const BACKUP_FILE = path.resolve(BACKUP_DIR, 'Madhya Pradesh.json.bak');

// ------------------------------------------------------------
// 1. Quotas Grouped by Institution & Domicile Type
// ------------------------------------------------------------
const INSTITUTION_DOMICILE_QUOTAS = {
  'Government (State Domicile)': [
    'MP Govt Quota'
  ],
  'Private (State Domicile)': [
    'MP Priv-Open'
  ],
  'Non-Domicile / Open (All India)': [
    'MP Priv-NonDomicile',
    'MP Govt-NonDomicile'
  ],
  'NRI Quota': [
    'MP Priv-NRI',
    'MP Priv-NRINonDomicil'
  ]
};

const VALID_QUOTAS = new Set();
for (const instType in INSTITUTION_DOMICILE_QUOTAS) {
  INSTITUTION_DOMICILE_QUOTAS[instType].forEach(q => VALID_QUOTAS.add(q));
}

// ------------------------------------------------------------
// 2. Categories Grouped by Reservation Eligibility
// ------------------------------------------------------------
const RESERVATION_ELIGIBILITY_CATEGORIES = {
  'Unreserved / General Merit (No Social Reservation)': [
    'UR/X/OP', 'UR (Non Domicile)'
  ],
  'Social Reservations (State Domicile Only)': [
    'OBC/X/OP', 'SC/X/OP', 'ST/X/OP', 'EWS/X/OP'
  ],
  'In-Service Medical Officers (Service Quota)': [
    'UR/X/OP Service', 'OBC/X/OP Service', 'SC/X/OP Service', 'ST/X/OP Service', 'EWS/X/OP Service'
  ],
  'Horizontal Reservations (PwD & NRI)': [
    'UR/PH/OP', 'SC/PH/OP', 'OBC/PH/OP', 'ST/PH/OP', 'EWS/PH/OP', 'UR/PH/OP Service',
    'UR/NRI/OP', 'UR/NRI (Non Domicile)'
  ]
};

const VALID_CATEGORIES = new Set();
for (const resType in RESERVATION_ELIGIBILITY_CATEGORIES) {
  RESERVATION_ELIGIBILITY_CATEGORIES[resType].forEach(c => VALID_CATEGORIES.add(c));
}

// ------------------------------------------------------------
// College ID Generation Function
// ------------------------------------------------------------
function generateCollegeId(state, instituteName) {
  const code = 'MP';
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
  console.log('Starting NEET PG Madhya Pradesh Cutoff ETL Extraction');
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
    { key: 'cr_2025_3', session: '2025', roundNum: '3' }
  ];

  const extractedCutoffs = [];
  const seenCutoffKeys = new Set();
  let duplicateCount = 0;
  let unmappedCollegesCount = 0;
  const unmappedCollegeNames = new Set();
  const categoryCounts = {};
  const quotaCounts = {};
  const institutionTypeCounts = {
    'Government (State Domicile)': 0,
    'Private (State Domicile)': 0,
    'Non-Domicile / Open (All India)': 0,
    'NRI Quota': 0
  };

  rawData.forEach(record => {
    const instName = record.institute ? record.institute.name : '';
    const collegeId = generateCollegeId('Madhya Pradesh', instName);

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

    // Track institution type counts
    for (const instType in INSTITUTION_DOMICILE_QUOTAS) {
      if (INSTITUTION_DOMICILE_QUOTAS[instType].includes(quotaCode)) {
        institutionTypeCounts[instType]++;
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
        authority: 'Madhya Pradesh',
        counselling: 'Madhya Pradesh',
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
  console.log('\n--- 1. Quotas Divided by Institution & Domicile Type ---');
  for (const instType in INSTITUTION_DOMICILE_QUOTAS) {
    const quotas = INSTITUTION_DOMICILE_QUOTAS[instType];
    const cutoffsInType = extractedCutoffs.filter(c => quotas.includes(c.quotaCode)).length;
    console.log(`  • ${instType}:`);
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

  // Verify categories against definition
  console.log('\n--- 2. Categories Divided by Reservation Eligibility ---');
  for (const resType in RESERVATION_ELIGIBILITY_CATEGORIES) {
    const cats = RESERVATION_ELIGIBILITY_CATEGORIES[resType];
    const cutoffsInCat = extractedCutoffs.filter(c => cats.includes(c.seatCategory)).length;
    console.log(`  • ${resType}:`);
    cats.forEach(c => console.log(`      - ${c}`));
    console.log(`    Total cutoffs: ${cutoffsInCat}`);
  }

  const uniqueExtractedCategories = new Set(extractedCutoffs.map(c => c.seatCategory));
  for (const c of uniqueExtractedCategories) {
    if (!VALID_CATEGORIES.has(c)) {
      console.error(`FATAL: Unexpected category in extracted data: "${c}"`);
      process.exit(1);
    }
  }

  // Verify mandatory allotments_count
  console.log('\n--- 3. Mandatory allotments_count Validation ---');
  let invalidAllotments = 0;
  for (let i = 0; i < extractedCutoffs.length; i++) {
    const count = extractedCutoffs[i].allotments_count;
    if (count == null || typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      invalidAllotments++;
    }
  }
  console.log(`Records with valid positive integer allotments_count: ${extractedCutoffs.length - invalidAllotments} / ${extractedCutoffs.length}`);
  if (invalidAllotments > 0) {
    console.error(`FATAL: Found ${invalidAllotments} records with invalid allotments_count!`);
    process.exit(1);
  }

  // Create backup of existing target file
  if (fs.existsSync(TARGET_FILE)) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
    console.log(`✓ Backed up existing target to ${BACKUP_FILE}`);
  }

  // Write out target file atomically
  fs.writeFileSync(TEMP_TARGET_FILE, JSON.stringify(extractedCutoffs, null, 2), 'utf8');
  fs.renameSync(TEMP_TARGET_FILE, TARGET_FILE);
  console.log(`✓ Atomically saved ${extractedCutoffs.length} records to ${TARGET_FILE}`);

  console.log('\n====================================================');
  console.log('ETL Pipeline for Madhya Pradesh Completed Successfully!');
  console.log('====================================================\n');
}

main();
