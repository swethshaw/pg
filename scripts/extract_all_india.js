#!/usr/bin/env node
/* ============================================================
   NEET PG College Predictor — All India Quotas ETL Pipeline
   ============================================================
   
   Extracts, transforms, and validates All India counselling cutoff
   data from the source JSON into the application's target format.
   
   Covers all 13 MCC All India counselling quotas grouped by Institution Type:
   - Government / All India:         AIQ
   - Central Universities (Govt):    DU, IP, BHU, AMU
   - Deemed Universities (Private):  MNG, NRI, MM, JM
   - Armed Forces (Defense):         AFMS, AFMS-DNB
   - DNB / NBE (Govt & Private):     DNB Post MBBS, NBE Diploma
   
   Source:  /Users/swethshaw/career plan b/datfile/All-India.json (READ-ONLY)
   Target:  /Users/swethshaw/career plan b/college_pre/data/cutoffs/All India.json
   
   Guarantees:
   - Source is treated as strictly read-only.
   - Extracts all 13 quotas across Government, Central, Deemed, Defense, and DNB.
   - Computes and exposes the mandatory `allotments_count` field (int >= 1).
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
const SOURCE_FILE = path.resolve(PROJECT_ROOT, '../datfile/All-India.json');
const TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/All India.json');
const TEMP_TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/All India.json.tmp');
const COLLEGES_FILE = path.resolve(PROJECT_ROOT, 'data/colleges.json');
const BACKUP_DIR = path.resolve(PROJECT_ROOT, 'data_backup/cutoffs');
const BACKUP_FILE = path.resolve(BACKUP_DIR, 'All India.json.bak');

// ------------------------------------------------------------
// All 13 Quotas Grouped by Institution Type
// ------------------------------------------------------------
const INSTITUTION_TYPE_QUOTAS = {
  'Government / All India': ['AIQ'],
  'Central Universities (Govt)': ['DU', 'IP', 'BHU', 'AMU'],
  'Deemed Universities (Private)': ['MNG', 'NRI', 'MM', 'JM'],
  'Armed Forces (Defense)': ['AFMS', 'AFMS-DNB'],
  'DNB / NBE (Govt & Private)': ['DNB Post MBBS', 'NBE Diploma']
};

const VALID_QUOTAS = new Set([
  'AIQ',
  'DU', 'IP', 'BHU', 'AMU',
  'MNG', 'NRI', 'MM', 'JM',
  'AFMS', 'AFMS-DNB',
  'DNB Post MBBS', 'NBE Diploma'
]);

// ------------------------------------------------------------
// State Code Mapping for College ID Generation
// ------------------------------------------------------------
const STATE_CODES = {
  'Andaman and Nicobar Islands': 'AA',
  'Andhra Pradesh': 'AP',
  'Arunachal Pradesh': 'AR',
  'Assam': 'AS',
  'Bihar': 'BR',
  'Chandigarh': 'CH',
  'Chhattisgarh': 'CG',
  'Dadra and Nagar Haveli': 'DN',
  'Daman and Diu': 'DD',
  'Delhi': 'DL',
  'Goa': 'GA',
  'Gujarat': 'GJ',
  'Haryana': 'HR',
  'Himachal Pradesh': 'HP',
  'Jammu and Kashmir': 'JK',
  'Jharkhand': 'JH',
  'Karnataka': 'KA',
  'Kerala': 'KL',
  'Ladakh': 'LA',
  'Madhya Pradesh': 'MP',
  'Maharashtra': 'MH',
  'Manipur': 'MN',
  'Meghalaya': 'ML',
  'Mizoram': 'MZ',
  'Nagaland': 'NL',
  'Odisha': 'OR',
  'Pondicherry': 'PY',
  'Puducherry': 'PY',
  'Punjab': 'PB',
  'Rajasthan': 'RJ',
  'Sikkim': 'SK',
  'Tamil Nadu': 'TN',
  'Telangana': 'TG',
  'Tripura': 'TR',
  'Uttar Pradesh': 'UP',
  'Uttarakhand': 'UK',
  'West Bengal': 'WB',
  'All India': 'AI'
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
  const yearStr = session.toString().slice(-2);
  return `${yearStr} round ${roundNum}`;
}

function runETL() {
  console.log('====================================================');
  console.log('Starting All India Cutoffs ETL (All 13 Quotas)');
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
  const distinctColleges = new Set();
  const distinctCourses = new Set();
  const distinctSpecialties = new Set();
  const distinctCategories = new Set();
  const distinctRounds = new Set();
  const distinctYears = new Set();
  const compositeKeySet = new Set();
  let duplicateCount = 0;
  let rejectedCount = 0;

  const roundKeys = [
    'cr_2024_1', 'cr_2024_2', 'cr_2024_3', 'cr_2024_4', 'cr_2024_5',
    'cr_2025_1', 'cr_2025_2', 'cr_2025_3', 'cr_2025_4'
  ];

  sourceData.forEach(row => {
    const quotaObj = row.quota || {};
    const quotaName = quotaObj.name || '';

    if (!VALID_QUOTAS.has(quotaName)) {
      rejectedCount++;
      return;
    }

    quotaCounts[quotaName] = (quotaCounts[quotaName] || 0) + 1;

    const instObj = row.institute || {};
    const instituteName = instObj.name || '';
    const courseObj = row.course || {};
    const courseName = courseObj.name || '';
    const state = row.state || 'All India';

    if (!instituteName || !courseName) {
      rejectedCount++;
      return;
    }

    const collegeId = generateCollegeId(state, instituteName);
    if (!collegesSet.has(collegeId)) {
      throw new Error(`Orphaned record: College ID "${collegeId}" not found in colleges.json`);
    }

    const { courseType, specialty } = normalizeCourse(courseName);
    const category = row.category || '';
    const fee = row.fee || '';
    const stipend = row.stipend_year_1 || '';

    distinctColleges.add(collegeId);
    distinctCourses.add(courseName);
    distinctSpecialties.add(specialty);
    distinctCategories.add(category);

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

      const compositeKey = `${collegeId}|${courseType}|${specialty}|${quotaName}|${category}|${year}|${roundFormatted}`;
      if (compositeKeySet.has(compositeKey)) {
        duplicateCount++;
      } else {
        compositeKeySet.add(compositeKey);
      }

      const cutoffRecord = {
        year: year,
        authority: 'All India',
        counselling: 'All India',
        round: roundFormatted,
        collegeId: collegeId,
        quotaCode: quotaName,
        course: courseType,
        specialty: specialty,
        seatCategory: category,
        closingRank: parseInt(closingRank, 10),
        allotments_count: allotmentsCount,
        numberOfAllotments: allotmentsCount,
        fee: fee,
        stipend: stipend
      };

      targetRecords.push(cutoffRecord);
    });
  });

  console.log(`\nRecords extracted by Institution Type & Quota:`);
  for (const [instType, quotas] of Object.entries(INSTITUTION_TYPE_QUOTAS)) {
    console.log(`  [${instType}]`);
    quotas.forEach(q => {
      console.log(`    - ${q.padEnd(16)}: ${quotaCounts[q] || 0} source records`);
    });
  }

  console.log(`\nRejected invalid records: ${rejectedCount}`);
  console.log(`Duplicates detected: ${duplicateCount}`);
  console.log(`Total transformed cutoff records: ${targetRecords.length}`);

  console.log('\nSorting records deterministically...');
  targetRecords.sort((a, b) => {
    if (a.collegeId !== b.collegeId) return a.collegeId.localeCompare(b.collegeId);
    if (a.course !== b.course) return a.course.localeCompare(b.course);
    if (a.specialty !== b.specialty) return a.specialty.localeCompare(b.specialty);
    if (a.quotaCode !== b.quotaCode) return a.quotaCode.localeCompare(b.quotaCode);
    if (a.seatCategory !== b.seatCategory) return a.seatCategory.localeCompare(b.seatCategory);
    if (a.year !== b.year) return b.year - a.year;
    return a.round.localeCompare(b.round);
  });

  console.log(`Writing to temporary file: ${TEMP_TARGET_FILE}...`);
  fs.mkdirSync(path.dirname(TEMP_TARGET_FILE), { recursive: true });
  fs.writeFileSync(TEMP_TARGET_FILE, JSON.stringify(targetRecords, null, 2), 'utf8');

  console.log('Validating temporary file...');
  const writtenData = JSON.parse(fs.readFileSync(TEMP_TARGET_FILE, 'utf8'));
  if (!Array.isArray(writtenData) || writtenData.length !== targetRecords.length) {
    throw new Error('Temporary file validation failed');
  }

  let minRank = Infinity;
  let maxRank = -Infinity;
  let minAllotments = Infinity;
  let maxAllotments = -Infinity;

  writtenData.forEach((rec, idx) => {
    if (!VALID_QUOTAS.has(rec.quotaCode)) {
      throw new Error(`Invalid quotaCode at ${idx}: ${rec.quotaCode}`);
    }
    if (typeof rec.allotments_count !== 'number' || rec.allotments_count < 1) {
      throw new Error(`Invalid allotments_count at ${idx}: ${rec.allotments_count}`);
    }
    if (rec.allotments_count !== rec.numberOfAllotments) {
      throw new Error(`allotments_count mismatch at ${idx}`);
    }
    if (typeof rec.closingRank !== 'number' || rec.closingRank <= 0) {
      throw new Error(`Invalid closingRank at ${idx}: ${rec.closingRank}`);
    }
    if (!collegesSet.has(rec.collegeId)) {
      throw new Error(`Unknown collegeId at ${idx}: ${rec.collegeId}`);
    }
    if (rec.closingRank < minRank) minRank = rec.closingRank;
    if (rec.closingRank > maxRank) maxRank = rec.closingRank;
    if (rec.allotments_count < minAllotments) minAllotments = rec.allotments_count;
    if (rec.allotments_count > maxAllotments) maxAllotments = rec.allotments_count;
  });

  if (!fs.existsSync(BACKUP_FILE)) {
    if (fs.existsSync(TARGET_FILE)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.copyFileSync(TARGET_FILE, BACKUP_FILE);
      console.log(`Created backup at: ${BACKUP_FILE}`);
    }
  }

  console.log(`Replacing target file: ${TARGET_FILE}...`);
  fs.renameSync(TEMP_TARGET_FILE, TARGET_FILE);
  const finalStats = fs.statSync(TARGET_FILE);
  console.log(`Successfully replaced target file. Size: ${(finalStats.size / (1024 * 1024)).toFixed(2)} MB`);

  console.log('\n====================================================');
  console.log('All India Quotas Extraction Completed Successfully');
  console.log('====================================================');
  console.log(`Total Source Records:          ${sourceData.length}`);
  console.log(`Output Cutoff Records:         ${writtenData.length}`);
  console.log(`Distinct Colleges:             ${distinctColleges.size}`);
  console.log(`Distinct Courses:              ${distinctCourses.size}`);
  console.log(`Distinct Specialties:          ${distinctSpecialties.size}`);
  console.log(`Distinct Categories:           ${distinctCategories.size}`);
  console.log(`Distinct Counselling Rounds:   ${distinctRounds.size}`);
  console.log(`Distinct Years:                ${Array.from(distinctYears).sort().join(', ')}`);
  console.log(`Rank Range:                    ${minRank} to ${maxRank}`);
  console.log(`Allotments Count Range:        ${minAllotments} to ${maxAllotments}`);
  console.log('====================================================\n');

  return {
    sourceCount: sourceData.length,
    outputCount: writtenData.length,
    distinctColleges: distinctColleges.size,
    distinctCourses: distinctCourses.size,
    distinctSpecialties: distinctSpecialties.size,
    distinctCategories: distinctCategories.size,
    distinctRounds: distinctRounds.size,
    minRank,
    maxRank,
    minAllotments,
    maxAllotments
  };
}

if (require.main === module) {
  try {
    runETL();
  } catch (err) {
    console.error('ETL Pipeline Failed:', err);
    process.exit(1);
  }
}

module.exports = { runETL, generateCollegeId, normalizeCourse, formatRound, INSTITUTION_TYPE_QUOTAS };
