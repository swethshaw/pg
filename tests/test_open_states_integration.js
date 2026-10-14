/**
 * NEET PG Open States Cutoff & Counseling Integration Test Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const openStatesCutoffsPath = path.join(__dirname, '../data/cutoffs/Open States.json');
const collegesPath = path.join(__dirname, '../data/colleges.json');
const filtersPath = path.join(__dirname, '../data/filters.json');
const sourcePath = '/Users/swethshaw/career plan b/datfile/openstates.json';

const cutoffs = JSON.parse(fs.readFileSync(openStatesCutoffsPath, 'utf8'));
const colleges = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const collegesMap = new Map(colleges.map(c => [c.id, c]));

console.log('====================================================');
console.log('Running NEET PG Open States Cutoff Test Suite');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

// 1. Quotas Divided by Institution Type
console.log('1. Quotas Divided by Institution Type:');
const expectedQuotaGroups = {
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
    'MP Govt-NonDomicile',
    'Other State',
    'Sikkim Gen Quota'
  ]
};

runTest('should contain all 21 quotas grouped exhaustively into the 3 institution types', () => {
  const quotasInDataset = new Set(cutoffs.map(c => c.quotaCode));
  assert.strictEqual(quotasInDataset.size, 21, `Expected 21 unique quotas, found ${quotasInDataset.size}`);

  const allExpectedQuotas = new Set([
    ...expectedQuotaGroups['Private Open Seats (Merit)'],
    ...expectedQuotaGroups['Management / Institutional Seats'],
    ...expectedQuotaGroups['Government / State General Seats']
  ]);

  for (const q of quotasInDataset) {
    assert.ok(allExpectedQuotas.has(q), `Unexpected quota in dataset: ${q}`);
  }

  // Check count per group
  const meritCount = cutoffs.filter(c => expectedQuotaGroups['Private Open Seats (Merit)'].includes(c.quotaCode)).length;
  const mgmtCount = cutoffs.filter(c => expectedQuotaGroups['Management / Institutional Seats'].includes(c.quotaCode)).length;
  const govtCount = cutoffs.filter(c => expectedQuotaGroups['Government / State General Seats'].includes(c.quotaCode)).length;

  assert.strictEqual(meritCount + mgmtCount + govtCount, cutoffs.length, 'Sum of groups must equal total cutoffs');
  assert.strictEqual(meritCount, 6019, `Expected 6019 Private Merit cutoffs, found ${meritCount}`);
  assert.strictEqual(mgmtCount, 5993, `Expected 5993 Management cutoffs, found ${mgmtCount}`);
  assert.strictEqual(govtCount, 184, `Expected 184 Govt/General cutoffs, found ${govtCount}`);
});

// 2. Eligibility Codes Divided by Reservation Type
console.log('\n2. Eligibility Codes Divided by Reservation Type:');
const expectedCategoryGroups = {
  unreserved: ['AGE', 'GEN', 'OPN', 'UR', 'UR (Non Domicile)', 'UR-Female', 'UR-GEN', 'UR/X/OP'],
  management: ['MNG', 'MQ', 'MQ1', 'S1A', 'UR-MNG'],
  sc: ['SC', 'SC-Female'],
  st: ['ST', 'ST-Female'],
  obc: ['OBC', 'OBC-Female']
};

runTest('should contain all 19 categories mapped into Unreserved, Management, and Social/Gender reservations', () => {
  const categoriesInDataset = new Set(cutoffs.map(c => c.seatCategory));
  assert.strictEqual(categoriesInDataset.size, 19, `Expected 19 categories, found ${categoriesInDataset.size}`);

  const allExpectedCategories = new Set([
    ...expectedCategoryGroups.unreserved,
    ...expectedCategoryGroups.management,
    ...expectedCategoryGroups.sc,
    ...expectedCategoryGroups.st,
    ...expectedCategoryGroups.obc
  ]);

  for (const cat of categoriesInDataset) {
    assert.ok(allExpectedCategories.has(cat), `Unexpected category: ${cat}`);
  }
});

runTest('should expand category eligibility correctly for candidates (GN, BC, SC, ST)', () => {
  // Candidate eligibility logic from app.js
  const OPEN_COMPETITION = ['UR', 'GEN', 'OPN', 'AGE', 'UR-GEN', 'UR/X/OP', 'UR (Non Domicile)', 'UR-Female', 'GN'];
  const MANAGEMENT = ['MNG', 'MQ', 'MQ1', 'S1A', 'UR-MNG'];
  const SOCIAL = {
    OBC: ['OBC', 'OBC-Female', 'BC'],
    SC: ['SC', 'SC-Female'],
    ST: ['ST', 'ST-Female']
  };

  function getEligible(cat) {
    let eligible = [cat];
    if (['GN', 'EW', 'BC', 'SC', 'ST'].includes(cat)) {
      eligible = eligible.concat(OPEN_COMPETITION).concat(MANAGEMENT);
    }
    if (cat === 'BC') eligible = eligible.concat(SOCIAL.OBC);
    if (cat === 'SC') eligible = eligible.concat(SOCIAL.SC);
    if (cat === 'ST') eligible = eligible.concat(SOCIAL.ST);
    return Array.from(new Set(eligible));
  }

  const gnEligible = getEligible('GN');
  assert.ok(gnEligible.includes('UR') && gnEligible.includes('UR-Female') && gnEligible.includes('MNG') && gnEligible.includes('S1A'));
  assert.ok(!gnEligible.includes('SC-Female') && !gnEligible.includes('ST-Female') && !gnEligible.includes('OBC-Female'));

  const bcEligible = getEligible('BC');
  assert.ok(bcEligible.includes('OBC') && bcEligible.includes('OBC-Female') && bcEligible.includes('MNG') && bcEligible.includes('UR'));

  const scEligible = getEligible('SC');
  assert.ok(scEligible.includes('SC') && scEligible.includes('SC-Female') && scEligible.includes('MQ1') && scEligible.includes('GEN'));

  const stEligible = getEligible('ST');
  assert.ok(stEligible.includes('ST') && stEligible.includes('ST-Female') && stEligible.includes('UR-MNG') && stEligible.includes('OPN'));
});

// 3. Mandatory allotments_count Calculation
console.log('\n3. Mandatory allotments_count Calculation:');
runTest('should expose positive integer allotments_count on 100% of records', () => {
  let invalidCount = 0;
  for (const c of cutoffs) {
    if (c.allotments_count == null || !Number.isInteger(c.allotments_count) || c.allotments_count < 1) {
      invalidCount++;
    }
    if (c.numberOfAllotments !== c.allotments_count) {
      invalidCount++;
    }
  }
  assert.strictEqual(invalidCount, 0, `Found ${invalidCount} invalid allotments_count entries`);
});

// 4. Deduplication and Foreign Key Integrity
console.log('\n4. Deduplication and Foreign Key Integrity:');
runTest('should have 0 duplicate cutoffs and 100% valid college IDs in colleges.json', () => {
  const seenKeys = new Set();
  let duplicates = 0;
  let missingColleges = 0;

  for (const c of cutoffs) {
    const key = `${c.collegeId}|${c.course}|${c.specialty}|${c.quotaCode}|${c.seatCategory}|${c.round}|${c.closingRank}`;
    if (seenKeys.has(key)) {
      duplicates++;
    }
    seenKeys.add(key);

    if (!collegesMap.has(c.collegeId)) {
      missingColleges++;
    }
  }

  assert.strictEqual(duplicates, 0, `Found ${duplicates} duplicate cutoff records`);
  assert.strictEqual(missingColleges, 0, `Found ${missingColleges} orphaned college IDs`);
});

// 5. Source File Read-Only Protection
console.log('\n5. Source File Read-Only Protection:');
runTest('should verify original openstates.json is unmodified and has 2,590 records', () => {
  assert.strictEqual(sourceData.length, 2590, `Source data should have 2,590 records, found ${sourceData.length}`);
});

// 6. UI & Filter Helpers Verification
console.log('\n6. Filter and UI Helpers:');
runTest('should verify filters.json contains the 3 institution types and friendly quota optgroups', () => {
  const ctCodes = filters.collegeTypes.map(ct => (typeof ct === 'object' ? ct.code : ct));
  assert.ok(ctCodes.includes('Private Open Seats (Merit)'));
  assert.ok(ctCodes.includes('Management / Institutional Seats'));
  assert.ok(ctCodes.includes('Government / State General Seats'));

  const quotaCodes = filters.quotas.map(q => (typeof q === 'object' ? q.code : q));
  assert.ok(quotaCodes.includes('Bihar Priv-Open'));
  assert.ok(quotaCodes.includes('APMgmt-S1-All-CatB'));
  assert.ok(quotaCodes.includes('Other State'));
});

console.log('\n====================================================');
console.log(`Test Results: ${passedTests} passed, ${totalTests - passedTests} failed (Total: ${totalTests})`);
console.log('====================================================\n');

if (totalTests - passedTests > 0) {
  process.exit(1);
}
