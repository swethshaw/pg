#!/usr/bin/env node
/* ============================================================
   NEET PG College Predictor — Open States Quotas & Categories ETL Pipeline
   ============================================================
   
   Extracts, transforms, and validates Open States cutoff data
   from the source JSON into the application target format.
   
   1. Quotas Divided by Institution Type:
      - Private Open Seats (Merit):
        Bihar Priv-Open, HP Priv All, KAR Priv Seats-Open, MP Priv-NonDomicile,
        Punjab Open Quota (AI Basis), Punjab Open Quota (AI Basis)-Converted,
        RAJ Priv-All India, UP Priv-Open Quota
      - Management / Institutional Seats:
        APMgmt-S1-All-CatB, HAR Priv-Mgmt, KAR Others (Inst.Q), PY Mgmt-Open,
        RAJ Priv-Mgmt Quota, Sikkim Mgmt Quota, TN Mgmt Quota,
        TELMgmt-MQ1-CatB-All, UK Priv-AllIndia/Mgmt, WB Mgmt Quota
      - Government / State General Seats:
        Other State (Chhattisgarh), MP Govt-NonDomicile, Sikkim Gen Quota
   
   2. Eligibility Codes Divided by Reservation Type:
      - Unreserved / General Merit (Open Competition):
        UR, GEN, OPN, AGE, UR-GEN, UR/X/OP, UR (Non Domicile), UR-Female
      - Management Quota (Institutional):
        MNG, MQ, MQ1, S1A, UR-MNG
      - Social & Gender Reservation:
        SC, SC-Female, ST, ST-Female, OBC, OBC-Female
   
   Source:  /Users/swethshaw/career plan b/datfile/openstates.json (READ-ONLY)
   Target:  /Users/swethshaw/career plan b/college_pre/data/cutoffs/Open States.json
   
   Guarantees:
   - Source is treated as strictly read-only.
   - Extracts all 21 quotas across Private Open, Management, and Government.
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
const SOURCE_FILE = path.resolve(PROJECT_ROOT, '../datfile/openstates.json');
const TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/Open States.json');
const TEMP_TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/Open States.json.tmp');
const COLLEGES_FILE = path.resolve(PROJECT_ROOT, 'data/colleges.json');
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'data_backup/cutoffs');
const BACKUP_FILE = path.resolve(BACKUP_DIR, 'Open States.json.bak');

// ------------------------------------------------------------
// 1. Quotas Grouped by Institution Type
// ------------------------------------------------------------
const INSTITUTION_TYPE_QUOTAS = {
  'Private Open Seats (Merit)': [
    'Bihar Priv-Open',
    'HP Priv All',
    'KAR Priv Seats-Open',
    'MP Priv-NonDomicile',
    'Punjab Open Quota (AI Basis)',
    'Punjab Open Quota (AI Basis)-Converted',
    'RAJ Priv-All India',
    'UP Priv-Open Quota'
  ],
  'Management / Institutional Seats': [
    'APMgmt-S1-All-CatB',
    'HAR Priv-Mgmt',
    'KAR Others (Inst.Q)',
    'PY Mgmt-Open',
    'RAJ Priv-Mgmt Quota',
    'Sikkim Mgmt Quota',
    'TELMgmt-MQ1-CatB-All',
    'TN Mgmt Quota',
    'UK Priv-AllIndia/Mgmt',
    'WB Mgmt Quota'
  ],
  'Government / State General Seats': [
    'Other State',
    'MP Govt-NonDomicile',
    'Sikkim Gen Quota'
  ]
};

const VALID_QUOTAS = new Set();
for (const instType in INSTITUTION_TYPE_QUOTAS) {
  INSTITUTION_TYPE_QUOTAS[instType].forEach(q => VALID_QUOTAS.add(q));
}

// ------------------------------------------------------------
// 2. Categories Grouped by Reservation Type
// ------------------------------------------------------------
const RESERVATION_TYPE_CATEGORIES = {
  'Unreserved / General Merit (Open Competition)': [
    'UR', 'GEN', 'OPN', 'AGE', 'UR-GEN', 'UR/X/OP', 'UR (Non Domicile)', 'UR-Female'
  ],
  'Management Quota (Institutional)': [
    'MNG', 'MQ', 'MQ1', 'S1A', 'UR-MNG'
  ],
  'Social & Gender Reservation': [
    'SC', 'SC-Female', 'ST', 'ST-Female', 'OBC', 'OBC-Female'
  ]
};

const VALID_CATEGORIES = new Set();
for (const resType in RESERVATION_TYPE_CATEGORIES) {
  RESERVATION_TYPE_CATEGORIES[resType].forEach(c => VALID_CATEGORIES.add(c));
}

// ------------------------------------------------------------
// State Code Mapping for College ID Generation
// ------------------------------------------------------------
const STATE_CODES = {
  'Andhra Pradesh': 'AP',
  'Bihar': 'BR',
  'Chhattisgarh': 'CG',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Karnataka': 'KA',
  'Madhya Pradesh': 'MP',
  'Pondicherry': 'PY',
  'Puducherry': 'PY',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TG',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB'
};

function generateCollegeId(state, instituteName) {
  const code = STATE_CODES[state] || 'XX';
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

function runETL() {
  console.log('====================================================');
  console.log('Starting Open States Cutoffs ETL Pipeline');
  console.log('====================================================\n');

  if (!fs.existsSync(SOURCE_FILE)) {
    throw new Error(`Source file does not exist: ${SOURCE_FILE}`);
  }
  console.log(`Source file: ${SOURCE_FILE}`);

  if (!fs.existsSync(COLLEGES_FILE)) {
    throw new Error(`Colleges file does not exist: ${COLLEGES_FILE}`);
  }
  const collegesRaw = JSON.parse(fs.readFileSync(COLLEGES_FILE, 'utf8'));
  const collegesSet = new Set(collegesRaw.map(c => c.id));
  console.log(`Loaded ${collegesSet.size} colleges from colleges.json for validation.\n`);

  console.log('Reading and parsing source data...');
  const sourceData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
  if (!Array.isArray(sourceData)) {
    throw new Error('Expected source data to be an array of records');
  }
  console.log(`Total source records inspected: ${sourceData.length}`);

  const targetRecords = [];
  const quotaCounts = {};
  const categoryCounts = {};
  const distinctColleges = new Set();
  const distinctCourses = new Set();
  const distinctSpecialties = new Set();
  const distinctRounds = new Set();
  const distinctYears = new Set();
  const compositeKeySet = new Set();
  let duplicateCount = 0;
  let rejectedCount = 0;

  const roundKeys = [
    'cr_2024_0', 'cr_2024_1', 'cr_2024_2', 'cr_2024_3', 'cr_2024_3.5', 'cr_2024_4', 'cr_2024_5', 'cr_2024_6',
    'cr_2025_0.1', 'cr_2025_0.2', 'cr_2025_1', 'cr_2025_2', 'cr_2025_3', 'cr_2025_3.5', 'cr_2025_4', 'cr_2025_4.5', 'cr_2025_5'
  ];

  sourceData.forEach(row => {
    const quotaObj = row.quota || {};
    const quotaCode = quotaObj.short_name || quotaObj.name || '';

    if (!VALID_QUOTAS.has(quotaCode)) {
      rejectedCount++;
      return;
    }

    const instObj = row.institute || {};
    const instituteName = instObj.name || '';
    const courseObj = row.course || {};
    const courseName = courseObj.name || '';
    const state = row.state || 'Other';

    if (!instituteName || !courseName) {
      rejectedCount++;
      return;
    }

    const collegeId = generateCollegeId(state, instituteName);
    if (!collegesSet.has(collegeId)) {
      throw new Error(`Orphaned record: College ID "${collegeId}" not found in colleges.json`);
    }

    const { courseType, specialty } = normalizeCourse(courseName);
    const category = typeof row.category === 'object' && row.category ? (row.category.name || row.category.code || '') : (row.category || '');

    if (!VALID_CATEGORIES.has(category)) {
      console.warn(`Encountered unknown category: "${category}" on row ${row.id}`);
    }

    const fee = row.fee || '';
    const stipend = row.stipend_year_1 || '';

    distinctColleges.add(collegeId);
    distinctCourses.add(courseName);
    distinctSpecialties.add(specialty);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    quotaCounts[quotaCode] = (quotaCounts[quotaCode] || 0) + 1;

    roundKeys.forEach(crKey => {
      const crData = row[crKey];
      if (!crData || typeof crData !== 'object') return;

      const closingRank = crData.ai_rank || crData.closing_rank;
      if (!closingRank || closingRank <= 0 || isNaN(closingRank)) return;

      const session = crData.session || (crKey.match(/cr_(\d{4})/) ? crKey.match(/cr_(\d{4})/)[1] : '');
      const roundNum = crData.round || (crKey.match(/cr_\d{4}_([\d.]+)/) ? crKey.match(/cr_\d{4}_([\d.]+)/)[1] : '');
      const year = parseInt(session, 10);
      if (!year || isNaN(year)) return;

      const roundFormatted = formatRound(year, roundNum);
      const allotmentsCount = (crData.allotments_count != null && !isNaN(crData.allotments_count))
        ? parseInt(crData.allotments_count, 10)
        : 1;

      if (allotmentsCount < 0) {
        throw new Error(`Negative allotments_count (${allotmentsCount}) for row ${row.id}, round ${crKey}`);
      }

      distinctRounds.add(roundFormatted);
      distinctYears.add(year);

      const compositeKey = `${collegeId}|${courseType}|${specialty}|${quotaCode}|${category}|${year}|${roundFormatted}`;
      if (compositeKeySet.has(compositeKey)) {
        duplicateCount++;
        return;
      }
      compositeKeySet.add(compositeKey);

      targetRecords.push({
        year: year,
        authority: 'Open States',
        counselling: 'Open States',
        round: roundFormatted,
        collegeId: collegeId,
        quotaCode: quotaCode,
        course: courseType,
        specialty: specialty,
        seatCategory: category,
        closingRank: parseInt(closingRank, 10),
        allotments_count: allotmentsCount,
        numberOfAllotments: allotmentsCount,
        fee: fee,
        stipend: stipend
      });
    });
  });

  console.log(`\nExtracted ${targetRecords.length} cutoff records.`);
  console.log(`Duplicates skipped: ${duplicateCount}`);
  console.log(`Rejected rows: ${rejectedCount}`);

  // Deterministic sorting
  targetRecords.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year; // newest year first
    if (a.quotaCode !== b.quotaCode) return a.quotaCode.localeCompare(b.quotaCode);
    if (a.collegeId !== b.collegeId) return a.collegeId.localeCompare(b.collegeId);
    if (a.course !== b.course) return a.course.localeCompare(b.course);
    if (a.specialty !== b.specialty) return a.specialty.localeCompare(b.specialty);
    if (a.seatCategory !== b.seatCategory) return a.seatCategory.localeCompare(b.seatCategory);
    return a.closingRank - b.closingRank;
  });

  // Verification Checks
  console.log('\n--- Running Sanity Checks ---');

  // Check 1: All 21 quotas present
  const extractedQuotas = new Set(targetRecords.map(r => r.quotaCode));
  console.log(`Distinct quotas extracted: ${extractedQuotas.size} (Expected: 21)`);
  VALID_QUOTAS.forEach(q => {
    if (!extractedQuotas.has(q)) {
      throw new Error(`Validation Error: Missing quota in target output: ${q}`);
    }
  });

  // Check 2: All 19 categories present
  const extractedCategories = new Set(targetRecords.map(r => r.seatCategory));
  console.log(`Distinct categories extracted: ${extractedCategories.size} (Expected: 19)`);
  VALID_CATEGORIES.forEach(c => {
    if (!extractedCategories.has(c)) {
      throw new Error(`Validation Error: Missing category in target output: ${c}`);
    }
  });

  // Check 3: Allotments count on 100% records
  let invalidAllotmentCount = 0;
  targetRecords.forEach((r, idx) => {
    if (r.allotments_count == null || typeof r.allotments_count !== 'number' || r.allotments_count < 1) {
      invalidAllotmentCount++;
    }
  });
  if (invalidAllotmentCount > 0) {
    throw new Error(`Validation Error: ${invalidAllotmentCount} records have invalid allotments_count!`);
  }
  console.log('✓ 100% records have valid allotments_count >= 1');

  // Check 4: All colleges exist in colleges.json
  targetRecords.forEach(r => {
    if (!collegesSet.has(r.collegeId)) {
      throw new Error(`Validation Error: College ID "${r.collegeId}" does not exist in colleges.json`);
    }
  });
  console.log('✓ 100% college foreign keys validated against colleges.json');

  // Print Summary Table by Institution Type
  console.log('\n--- Breakdown by Institution Type ---');
  for (const [instType, quotas] of Object.entries(INSTITUTION_TYPE_QUOTAS)) {
    let instCount = 0;
    quotas.forEach(q => {
      const qRows = targetRecords.filter(r => r.quotaCode === q);
      instCount += qRows.length;
    });
    console.log(`• ${instType}: ${instCount} cutoffs across ${quotas.length} quotas`);
    quotas.forEach(q => {
      const count = targetRecords.filter(r => r.quotaCode === q).length;
      console.log(`    - ${q}: ${count} cutoffs`);
    });
  }

  // Print Summary Table by Reservation Type
  console.log('\n--- Breakdown by Reservation Type ---');
  for (const [resType, categories] of Object.entries(RESERVATION_TYPE_CATEGORIES)) {
    let resCount = 0;
    categories.forEach(c => {
      const cRows = targetRecords.filter(r => r.seatCategory === c);
      resCount += cRows.length;
    });
    console.log(`• ${resType}: ${resCount} cutoffs across ${categories.length} categories`);
    categories.forEach(c => {
      const count = targetRecords.filter(r => r.seatCategory === c).length;
      console.log(`    - ${c}: ${count} cutoffs`);
    });
  }

  // Backup existing target file if present
  if (fs.existsSync(TARGET_FILE)) {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
    console.log(`\nCreated backup of existing target file: ${BACKUP_FILE}`);
  }

  // Atomic file write
  console.log(`Writing ${targetRecords.length} records to temporary file...`);
  fs.writeFileSync(TEMP_TARGET_FILE, JSON.stringify(targetRecords, null, 2), 'utf8');

  // Atomic rename
  fs.renameSync(TEMP_TARGET_FILE, TARGET_FILE);
  console.log(`Atomic update successful: ${TARGET_FILE}`);
  console.log('\n====================================================');
  console.log('Open States Cutoffs ETL Pipeline Completed Successfully!');
  console.log('====================================================\n');
}

if (require.main === module) {
  try {
    runETL();
  } catch (err) {
    console.error('\nETL Pipeline FAILED with error:');
    console.error(err);
    if (fs.existsSync(TEMP_TARGET_FILE)) {
      fs.unlinkSync(TEMP_TARGET_FILE);
    }
    process.exit(1);
  }
}

module.exports = {
  runETL,
  INSTITUTION_TYPE_QUOTAS,
  RESERVATION_TYPE_CATEGORIES,
  VALID_QUOTAS,
  VALID_CATEGORIES,
  generateCollegeId,
  normalizeCourse,
  formatRound
};
