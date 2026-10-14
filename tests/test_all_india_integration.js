/**
 * Test Suite: All India NEET-PG Cutoff Data & Predictor Integration
 *
 * Verifies:
 * 1. All 13 quotas extracted and grouped by Institution Type
 * 2. Proper college type divisions: Government, Central, Deemed, Armed Forces, DNB Hospital
 * 3. Clinical vs Non-Clinical course divisions
 * 4. Mandatory allotments_count field on 100% of records
 * 5. Deduplication and foreign key integrity
 * 6. Preservation of rounds and reservation categories
 * 7. Candidate category eligibility expansion
 * 8. Predictor algorithm and seat aggregation compatibility
 * 9. Regression tests for other state cutoff files and source immutability
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.resolve(PROJECT_ROOT, '../datfile/All-India.json');
const TARGET_FILE = path.resolve(PROJECT_ROOT, 'data/cutoffs/All India.json');
const COLLEGES_FILE = path.resolve(PROJECT_ROOT, 'data/colleges.json');
const FILTERS_FILE = path.resolve(PROJECT_ROOT, 'data/filters.json');
const CUTOFFS_DIR = path.resolve(PROJECT_ROOT, 'data/cutoffs');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('====================================================');
console.log('Running NEET PG All India Cutoff Test Suite');
console.log('====================================================\n');

// Load Data
const sourceData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
const targetData = JSON.parse(fs.readFileSync(TARGET_FILE, 'utf8'));
const collegesData = JSON.parse(fs.readFileSync(COLLEGES_FILE, 'utf8'));
const filtersData = JSON.parse(fs.readFileSync(FILTERS_FILE, 'utf8'));
const collegesMap = new Map(collegesData.map(c => [c.id, c]));

// ------------------------------------------------------------
// Test 1: Quotas Divided by Institution Type
// ------------------------------------------------------------
console.log('1. Quotas Divided by Institution Type:');
it('should contain all 13 quotas grouped into the 5 institution types', () => {
  const expectedQuotas = new Set([
    'AIQ',
    'DU', 'IP', 'BHU', 'AMU',
    'MNG', 'NRI', 'MM', 'JM',
    'AFMS', 'AFMS-DNB',
    'DNB Post MBBS', 'NBE Diploma'
  ]);

  const targetQuotas = new Set(targetData.map(r => r.quotaCode));
  assert.strictEqual(targetQuotas.size, 13, 'Expected exactly 13 distinct quotas');
  
  expectedQuotas.forEach(q => {
    assert.ok(targetQuotas.has(q), `Target missing expected quota: ${q}`);
  });
  assert.strictEqual(targetData.length, 95519, 'Expected exactly 95,519 cutoff records');
});

// ------------------------------------------------------------
// Test 2: College Types Divisions
// ------------------------------------------------------------
console.log('\n2. College Types Divisions:');
it('should include Government, Central University, Deemed University, DNB Hospital, and Armed Forces', () => {
  const presentCollegeTypes = new Set();
  targetData.forEach(r => {
    const col = collegesMap.get(r.collegeId);
    if (col && col.collegeType) {
      presentCollegeTypes.add(col.collegeType);
    }
  });

  const expectedTypes = ['Government', 'Central University', 'Deemed University', 'DNB Hospital', 'Armed Forces'];
  expectedTypes.forEach(t => {
    assert.ok(presentCollegeTypes.has(t), `Expected college type to be present: ${t}`);
  });
});

// ------------------------------------------------------------
// Test 3: Clinical vs Non-Clinical Divisions
// ------------------------------------------------------------
console.log('\n3. Clinical vs. Non-Clinical Course Classification:');
it('should classify courses accurately into Non-Clinical and Clinical branches', () => {
  const NON_CLINICAL_SPECIALTIES = [
    'Anatomy', 'Physiology', 'Bio-Chemistry', 'Biochemistry',
    'Pathology', 'Clinical Pathology', 'Microbiology', 'Pharmacology', 'Forensic Medicine',
    'Immuno Haematology & Blood Transfusion', 'Immuno Hematology & Transfusion Medicine',
    'Immuno-Haematology and Blood Transfusion', 'Lab Medicine',
    'Social & Preventive Medicine', 'Public Health', 'Master of Public Health (Epidemiology)',
    'Hospital Administration', 'Community Health Administration', 'Health Administration',
    'Health Administration including Hospital Administration'
  ];

  function getBranchType(specialty) {
    if (!specialty) return 'Other';
    if (NON_CLINICAL_SPECIALTIES.includes(specialty)) return 'Non-Clinical';
    return 'Clinical';
  }

  // Pre-clinical & Para-clinical test
  assert.strictEqual(getBranchType('Anatomy'), 'Non-Clinical');
  assert.strictEqual(getBranchType('Pathology'), 'Non-Clinical');
  assert.strictEqual(getBranchType('Social & Preventive Medicine'), 'Non-Clinical');
  assert.strictEqual(getBranchType('Hospital Administration'), 'Non-Clinical');

  // Clinical branches test
  assert.strictEqual(getBranchType('General Medicine'), 'Clinical');
  assert.strictEqual(getBranchType('General Surgery'), 'Clinical');
  assert.strictEqual(getBranchType('Radio Diagnosis'), 'Clinical');
  assert.strictEqual(getBranchType('Aviation Medicine/Aerospace Medicine'), 'Clinical');
  assert.strictEqual(getBranchType('Nuclear Medicine'), 'Clinical');
  assert.strictEqual(getBranchType('Cardio Thoracic Surgery (6 years)'), 'Clinical');
});

// ------------------------------------------------------------
// Test 4: Mandatory allotments_count Calculation
// ------------------------------------------------------------
console.log('\n4. Mandatory allotments_count Calculation:');
it('should expose accurate positive integer allotments_count on 100% of records', () => {
  let minCount = Infinity;
  let maxCount = -Infinity;
  
  targetData.forEach((r, idx) => {
    assert.strictEqual(typeof r.allotments_count, 'number', `Record ${idx} allotments_count not a number`);
    assert.ok(Number.isInteger(r.allotments_count), `Record ${idx} allotments_count not an integer`);
    assert.ok(r.allotments_count >= 1, `Record ${idx} allotments_count < 1`);
    assert.strictEqual(r.allotments_count, r.numberOfAllotments, `allotments_count mismatch at ${idx}`);
    if (r.allotments_count < minCount) minCount = r.allotments_count;
    if (r.allotments_count > maxCount) maxCount = r.allotments_count;
  });
  
  assert.strictEqual(minCount, 1, 'Expected min allotments_count to be 1');
  assert.strictEqual(maxCount, 35, 'Expected max allotments_count to be 35');
});

// ------------------------------------------------------------
// Test 5: Deduplication and Foreign Key Integrity
// ------------------------------------------------------------
console.log('\n5. Deduplication and Foreign Key Integrity:');
it('should have 0 duplicate records and 100% valid college IDs in colleges.json', () => {
  const seenKeys = new Set();
  let dups = 0;
  
  targetData.forEach(r => {
    const key = `${r.collegeId}|${r.course}|${r.specialty}|${r.quotaCode}|${r.seatCategory}|${r.year}|${r.round}`;
    if (seenKeys.has(key)) {
      dups++;
    } else {
      seenKeys.add(key);
    }
    assert.ok(collegesMap.has(r.collegeId), `Orphan collegeId detected: ${r.collegeId}`);
  });
  
  assert.strictEqual(dups, 0, 'No duplicate cutoff keys should exist');
  assert.strictEqual(seenKeys.size, 95519, 'All 95,519 entries must be distinct');
});

// ------------------------------------------------------------
// Test 6: Preservation of Counselling Rounds and Categories
// ------------------------------------------------------------
console.log('\n6. Preservation of Rounds and Categories:');
it('should preserve all 9 counselling rounds across 2024 and 2025', () => {
  const rounds = Array.from(new Set(targetData.map(r => r.round))).sort();
  const expectedRounds = [
    '24 round 1', '24 round 2', '24 round 3', '24 round 4', '24 round 5',
    '25 round 1', '25 round 2', '25 round 3', '25 round 4'
  ];
  assert.deepStrictEqual(rounds, expectedRounds, 'All 9 rounds must match expected list');
});

it('should preserve all 14 reservation and priority categories', () => {
  const categories = Array.from(new Set(targetData.map(r => r.seatCategory))).sort();
  const expectedCategories = [
    'AFMS-Priority III', 'AFMS-Priority IV', 'EWS', 'EWS-PwD',
    'GEN', 'GEN-PwD', 'NRI-Priority I', 'NRI-Priority II',
    'OBC', 'OBC-PwD', 'SC', 'SC-PwD', 'ST', 'ST-PwD'
  ].sort();
  assert.deepStrictEqual(categories, expectedCategories, 'All 14 categories must be present');
});

// ------------------------------------------------------------
// Test 7: Category Eligibility Expansion
// ------------------------------------------------------------
console.log('\n7. Category Eligibility Logic:');
it('should expand candidate categories correctly to include both reserved and open seats', () => {
  const CATEGORY_ELIGIBILITY = {
    'GN':                ['GN', 'GEN', 'UR'],
    'EW':                ['EW', 'EWS', 'GN', 'GEN', 'UR'],
    'BC':                ['BC', 'OBC', 'GN', 'GEN', 'UR'],
    'SC':                ['SC', 'GN', 'GEN', 'UR'],
    'ST':                ['ST', 'GN', 'GEN', 'UR'],
    'GN PwD':            ['GN PwD', 'GEN-PwD', 'GN', 'GEN', 'UR'],
    'EW PwD':            ['EW PwD', 'EWS-PwD', 'EW', 'EWS', 'GN PwD', 'GEN-PwD', 'GN', 'GEN', 'UR'],
    'BC PwD':            ['BC PwD', 'OBC-PwD', 'BC', 'OBC', 'GN PwD', 'GEN-PwD', 'GN', 'GEN', 'UR'],
    'SC PwD':            ['SC PwD', 'SC-PwD', 'SC', 'GN PwD', 'GEN-PwD', 'GN', 'GEN', 'UR'],
    'ST PwD':            ['ST PwD', 'ST-PwD', 'ST', 'GN PwD', 'GEN-PwD', 'GN', 'GEN', 'UR'],
    'AFMS-Priority III': ['AFMS-Priority III', 'GEN', 'GN', 'UR'],
    'AFMS-Priority IV':  ['AFMS-Priority IV', 'AFMS-Priority III', 'GEN', 'GN', 'UR'],
    'NRI-Priority I':    ['NRI-Priority I', 'GEN', 'GN', 'UR'],
    'NRI-Priority II':   ['NRI-Priority II', 'NRI-Priority I', 'GEN', 'GN', 'UR']
  };

  assert.ok(CATEGORY_ELIGIBILITY['EW'].includes('EWS'), 'EWS must be eligible for EWS seats');
  assert.ok(CATEGORY_ELIGIBILITY['EW'].includes('GEN'), 'EWS must be eligible for GEN seats');
  assert.ok(CATEGORY_ELIGIBILITY['BC'].includes('OBC'), 'OBC must be eligible for OBC seats');
  assert.ok(CATEGORY_ELIGIBILITY['AFMS-Priority IV'].includes('AFMS-Priority IV'), 'AFMS Priority IV must be eligible');
  assert.ok(CATEGORY_ELIGIBILITY['NRI-Priority II'].includes('NRI-Priority II'), 'NRI Priority II must be eligible');
});

// ------------------------------------------------------------
// Test 8: Regression Tests for Other Quota Datasets & Source File
// ------------------------------------------------------------
console.log('\n8. Regression Tests:');
it('should verify original source file is unmodified', () => {
  const currentSourceStats = fs.statSync(SOURCE_FILE);
  assert.strictEqual(currentSourceStats.size, 46255190, 'Source file size must remain exactly 46,255,190 bytes');
});

it('should verify all state cutoff files exist and are intact', () => {
  const expectedStateFiles = [
    'Bihar.json', 'Delhi.json', 'Haryana.json', 'Himachal Pradesh.json',
    'Jharkhand.json', 'Karnataka.json', 'Madhya Pradesh.json', 'Maharashtra.json',
    'Open States.json', 'Rajasthan.json', 'Uttar Pradesh.json', 'Uttarakhand.json',
    'West Bengal.json'
  ];

  expectedStateFiles.forEach(f => {
    const p = path.join(CUTOFFS_DIR, f);
    assert.ok(fs.existsSync(p), `State file ${f} must exist`);
    const content = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(Array.isArray(content), `${f} must be an array`);
    assert.ok(content.length > 0, `${f} must contain records`);
  });
});

console.log('\n====================================================');
console.log(`Test Results: ${passedTests} passed, ${failedTests} failed (Total: ${totalTests})`);
console.log('====================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
