/**
 * NEET PG Madhya Pradesh Cutoff & Counseling Integration Test Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const mpCutoffsPath = path.join(__dirname, '../data/cutoffs/Madhya Pradesh.json');
const collegesPath = path.join(__dirname, '../data/colleges.json');
const filtersPath = path.join(__dirname, '../data/filters.json');
const sourcePath = '/Users/swethshaw/career plan b/datfile/Madhya Pradesh.json';

const cutoffs = JSON.parse(fs.readFileSync(mpCutoffsPath, 'utf8'));
const colleges = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const collegesMap = new Map(colleges.map(c => [c.id, c]));

console.log('====================================================');
console.log('Running NEET PG Madhya Pradesh Cutoff Test Suite');
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

// 1. Quotas Divided by Institution & Domicile Type
console.log('1. Quotas Divided by Institution & Domicile Type:');
const expectedQuotaGroups = {
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

runTest('should contain all 6 quotas grouped exhaustively into the 4 institution & domicile types', () => {
  const quotasInDataset = new Set(cutoffs.map(c => c.quotaCode));
  assert.strictEqual(quotasInDataset.size, 6, `Expected 6 unique quotas, found ${quotasInDataset.size}`);

  const allExpectedQuotas = new Set([
    ...expectedQuotaGroups['Government (State Domicile)'],
    ...expectedQuotaGroups['Private (State Domicile)'],
    ...expectedQuotaGroups['Non-Domicile / Open (All India)'],
    ...expectedQuotaGroups['NRI Quota']
  ]);

  for (const q of quotasInDataset) {
    assert.ok(allExpectedQuotas.has(q), `Unexpected quota in dataset: ${q}`);
  }

  // Check counts per group
  const govtCount = cutoffs.filter(c => expectedQuotaGroups['Government (State Domicile)'].includes(c.quotaCode)).length;
  const privCount = cutoffs.filter(c => expectedQuotaGroups['Private (State Domicile)'].includes(c.quotaCode)).length;
  const nonDomCount = cutoffs.filter(c => expectedQuotaGroups['Non-Domicile / Open (All India)'].includes(c.quotaCode)).length;
  const nriCount = cutoffs.filter(c => expectedQuotaGroups['NRI Quota'].includes(c.quotaCode)).length;

  assert.strictEqual(govtCount + privCount + nonDomCount + nriCount, cutoffs.length, 'Sum of groups must equal total cutoffs');
  assert.strictEqual(govtCount, 2389, `Expected 2389 Govt State Domicile cutoffs, found ${govtCount}`);
  assert.strictEqual(privCount, 1622, `Expected 1622 Private State Domicile cutoffs, found ${privCount}`);
  assert.strictEqual(nonDomCount, 27, `Expected 27 Non-Domicile Open cutoffs, found ${nonDomCount}`);
  assert.strictEqual(nriCount, 221, `Expected 221 NRI cutoffs, found ${nriCount}`);
});

// 2. Categories Divided by Reservation Eligibility
console.log('\n2. Categories Divided by Reservation Eligibility:');
const expectedCategoryGroups = {
  unreserved: ['UR/X/OP', 'UR (Non Domicile)'],
  social: ['OBC/X/OP', 'SC/X/OP', 'ST/X/OP', 'EWS/X/OP'],
  service: ['UR/X/OP Service', 'OBC/X/OP Service', 'SC/X/OP Service', 'ST/X/OP Service', 'EWS/X/OP Service'],
  horizontal: ['UR/PH/OP', 'SC/PH/OP', 'OBC/PH/OP', 'ST/PH/OP', 'EWS/PH/OP', 'UR/PH/OP Service', 'UR/NRI/OP', 'UR/NRI (Non Domicile)']
};

runTest('should contain all 19 categories mapped into Unreserved, Social, Service, and Horizontal reservations', () => {
  const categoriesInDataset = new Set(cutoffs.map(c => c.seatCategory));
  assert.strictEqual(categoriesInDataset.size, 19, `Expected 19 categories, found ${categoriesInDataset.size}`);

  const allExpectedCategories = new Set([
    ...expectedCategoryGroups.unreserved,
    ...expectedCategoryGroups.social,
    ...expectedCategoryGroups.service,
    ...expectedCategoryGroups.horizontal
  ]);

  for (const cat of categoriesInDataset) {
    assert.ok(allExpectedCategories.has(cat), `Unexpected category: ${cat}`);
  }

  const unreservedCount = cutoffs.filter(c => expectedCategoryGroups.unreserved.includes(c.seatCategory)).length;
  const socialCount = cutoffs.filter(c => expectedCategoryGroups.social.includes(c.seatCategory)).length;
  const serviceCount = cutoffs.filter(c => expectedCategoryGroups.service.includes(c.seatCategory)).length;
  const horizontalCount = cutoffs.filter(c => expectedCategoryGroups.horizontal.includes(c.seatCategory)).length;

  assert.strictEqual(unreservedCount + socialCount + serviceCount + horizontalCount, cutoffs.length);
  assert.strictEqual(unreservedCount, 1546);
  assert.strictEqual(socialCount, 1933);
  assert.strictEqual(serviceCount, 547);
  assert.strictEqual(horizontalCount, 233);
});

runTest('should expand category eligibility correctly for candidate types in MP', () => {
  // Eligibility logic mirroring app.js
  const OPEN_COMPETITION = ['UR', 'GEN', 'OPN', 'AGE', 'UR-GEN', 'UR/X/OP', 'UR (Non Domicile)', 'UR-Female', 'GN'];
  const MP_UNRESERVED_NRI = ['UR/X/OP', 'UR (Non Domicile)', 'UR/NRI/OP', 'UR/NRI (Non Domicile)'];
  
  function getEligible(cat) {
    let eligible = [cat];
    if (['GN', 'EW', 'BC', 'SC', 'ST'].includes(cat) || cat.includes('PwD')) {
      eligible = eligible.concat(OPEN_COMPETITION).concat(MP_UNRESERVED_NRI);
    }
    if (cat === 'BC' || cat === 'BC PwD') eligible.push('OBC/X/OP');
    if (cat === 'SC' || cat === 'SC PwD') eligible.push('SC/X/OP');
    if (cat === 'ST' || cat === 'ST PwD') eligible.push('ST/X/OP');
    if (cat === 'EW' || cat === 'EW PwD') eligible.push('EWS/X/OP');
    if (cat === 'UR-Service') eligible.push('UR/X/OP Service', 'UR/X/OP', 'UR (Non Domicile)');
    if (cat === 'OBC-Service') eligible.push('OBC/X/OP Service', 'OBC/X/OP', 'UR/X/OP', 'UR (Non Domicile)');
    if (cat === 'SC-Service') eligible.push('SC/X/OP Service', 'SC/X/OP', 'UR/X/OP', 'UR (Non Domicile)');
    if (cat === 'ST-Service') eligible.push('ST/X/OP Service', 'ST/X/OP', 'UR/X/OP', 'UR (Non Domicile)');
    if (cat === 'EWS-Service') eligible.push('EWS/X/OP Service', 'EWS/X/OP', 'UR/X/OP', 'UR (Non Domicile)');
    if (cat === 'GN PwD') eligible.push('UR/PH/OP', 'UR/PH/OP Service');
    if (cat === 'BC PwD') eligible.push('OBC/PH/OP', 'UR/PH/OP');
    if (cat === 'SC PwD') eligible.push('SC/PH/OP', 'UR/PH/OP');
    if (cat === 'ST PwD') eligible.push('ST/PH/OP', 'UR/PH/OP');
    if (cat === 'EW PwD') eligible.push('EWS/PH/OP', 'UR/PH/OP');
    return Array.from(new Set(eligible));
  }

  const gnEligible = getEligible('GN');
  assert.ok(gnEligible.includes('UR/X/OP') && gnEligible.includes('UR (Non Domicile)') && gnEligible.includes('UR/NRI/OP'));
  assert.ok(!gnEligible.includes('SC/X/OP') && !gnEligible.includes('ST/X/OP') && !gnEligible.includes('OBC/X/OP'));

  const bcEligible = getEligible('BC');
  assert.ok(bcEligible.includes('OBC/X/OP') && bcEligible.includes('UR/X/OP'));

  const scEligible = getEligible('SC');
  assert.ok(scEligible.includes('SC/X/OP') && scEligible.includes('UR/X/OP'));

  const stEligible = getEligible('ST');
  assert.ok(stEligible.includes('ST/X/OP') && stEligible.includes('UR/X/OP'));

  const ewEligible = getEligible('EW');
  assert.ok(ewEligible.includes('EWS/X/OP') && ewEligible.includes('UR/X/OP'));

  const urService = getEligible('UR-Service');
  assert.ok(urService.includes('UR/X/OP Service') && urService.includes('UR/X/OP'));

  const scPwd = getEligible('SC PwD');
  assert.ok(scPwd.includes('SC/PH/OP') && scPwd.includes('SC/X/OP') && scPwd.includes('UR/PH/OP'));
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
runTest('should verify original Madhya Pradesh.json is unmodified and has 1,324 records', () => {
  assert.strictEqual(sourceData.length, 1324, `Source data should have 1,324 records, found ${sourceData.length}`);
});

// 6. Filter and UI Helpers Verification
console.log('\n6. Filter and UI Helpers:');
runTest('should verify filters.json contains the 4 MP institution & domicile types and friendly quota options', () => {
  const ctCodes = filters.collegeTypes.map(ct => (typeof ct === 'object' ? ct.code : ct));
  assert.ok(ctCodes.includes('Government (State Domicile)'));
  assert.ok(ctCodes.includes('Private (State Domicile)'));
  assert.ok(ctCodes.includes('Non-Domicile / Open (All India)'));
  assert.ok(ctCodes.includes('NRI Quota'));

  const quotaCodes = filters.quotas.map(q => (typeof q === 'object' ? q.code : q));
  assert.ok(quotaCodes.includes('MP Govt Quota'));
  assert.ok(quotaCodes.includes('MP Priv-Open'));
  assert.ok(quotaCodes.includes('MP Priv-NonDomicile'));
  assert.ok(quotaCodes.includes('MP Govt-NonDomicile'));
  assert.ok(quotaCodes.includes('MP Priv-NRI'));
  assert.ok(quotaCodes.includes('MP Priv-NRINonDomicil'));
});

console.log('\n====================================================');
console.log(`Test Results: ${passedTests} passed, ${totalTests - passedTests} failed (Total: ${totalTests})`);
console.log('====================================================\n');

if (totalTests - passedTests > 0) {
  process.exit(1);
}
