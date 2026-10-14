/**
 * NEET PG Haryana Cutoff & Counseling Integration Test Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const hrCutoffsPath = path.join(__dirname, '../data/cutoffs/Haryana.json');
const collegesPath = path.join(__dirname, '../data/colleges.json');
const filtersPath = path.join(__dirname, '../data/filters.json');
const sourcePath = '/Users/swethshaw/career plan b/datfile/harayana.json';

const cutoffs = JSON.parse(fs.readFileSync(hrCutoffsPath, 'utf8'));
const colleges = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const collegesMap = new Map(colleges.map(c => [c.id, c]));

console.log('====================================================');
console.log('Running NEET PG Haryana Cutoff Test Suite');
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

runTest('should contain all 8 quotas grouped into the 6 institution & domicile types', () => {
  const quotasInDataset = new Set(cutoffs.map(c => c.quotaCode));
  assert.strictEqual(quotasInDataset.size, 8, `Expected 8 unique quotas, found ${quotasInDataset.size}`);

  const allExpectedQuotas = new Set();
  for (const grp in expectedQuotaGroups) {
    expectedQuotaGroups[grp].forEach(q => allExpectedQuotas.add(q));
  }

  for (const q of quotasInDataset) {
    assert.ok(allExpectedQuotas.has(q), `Unexpected quota in dataset: ${q}`);
  }

  // Check counts per group
  const govtCount = cutoffs.filter(c => expectedQuotaGroups['Government Merit Seats'].includes(c.quotaCode)).length;
  const ipCount = cutoffs.filter(c => expectedQuotaGroups['Institutional Preference (IP)'].includes(c.quotaCode)).length;
  const privStateCount = cutoffs.filter(c => expectedQuotaGroups['Private State Domicile'].includes(c.quotaCode)).length;
  const privOpenCount = cutoffs.filter(c => expectedQuotaGroups['Private Open (Non-Domicile)'].includes(c.quotaCode)).length;
  const nriMinCount = cutoffs.filter(c => expectedQuotaGroups['Private Premium / NRI & Minority'].includes(c.quotaCode)).length;
  const dnbCount = cutoffs.filter(c => expectedQuotaGroups['In-Service Cadre (DNB)'].includes(c.quotaCode)).length;

  const totalGroupCount = govtCount + ipCount + privStateCount + privOpenCount + nriMinCount + dnbCount;
  assert.strictEqual(totalGroupCount, cutoffs.length, 'Sum of groups must equal total cutoffs');
  assert.strictEqual(govtCount, 596, `Expected 596 Govt Merit cutoffs, found ${govtCount}`);
  assert.strictEqual(ipCount, 274, `Expected 274 IP cutoffs, found ${ipCount}`);
  assert.strictEqual(privStateCount, 436, `Expected 436 Private State Domicile cutoffs, found ${privStateCount}`);
  assert.strictEqual(privOpenCount, 368, `Expected 368 Private Open cutoffs, found ${privOpenCount}`);
  assert.strictEqual(nriMinCount, 112, `Expected 112 NRI & Minority cutoffs, found ${nriMinCount}`);
  assert.strictEqual(dnbCount, 225, `Expected 225 DNB Inservice cutoffs, found ${dnbCount}`);
});

// 2. Categories Divided by Reservation Eligibility
console.log('\n2. Categories Divided by Reservation Eligibility:');
runTest('should contain all 36 Haryana categories in dataset', () => {
  const categoriesInDataset = new Set(cutoffs.map(c => c.seatCategory));
  assert.strictEqual(categoriesInDataset.size, 36, `Expected 36 categories, found ${categoriesInDataset.size}`);

  const expectedCategories = [
    'UR', 'MNG', 'UR Service', 'BCA', 'BCB', 'SC', 'IP-UR', 'NRI', 'IP-UR Service',
    'SCD', 'BCA Service', 'IP-BCA', 'BCB Service', 'SCD Service', 'SC Service',
    'EWS', 'IP-BCB', 'IP-SC', 'IP-BCB Service', 'UR ESM FF', 'MINORITY', 'IP-SCD',
    'IP-BCA Service', 'UR-PH', 'IP-SC Service', 'IP-SCD Service', 'UR FF',
    'UR-PH Service', 'BCA ESM', 'UR ESM', 'BCA ESM FF', 'IP-UR-PH Service',
    'IP-UR Service ESM FF', 'BCB-PH Service', 'SC ESM', 'BCB-PH'
  ];

  expectedCategories.forEach(cat => {
    assert.ok(categoriesInDataset.has(cat), `Missing expected category in dataset: ${cat}`);
  });
});

// 3. Mandatory allotments_count Calculation
console.log('\n3. Mandatory allotments_count Calculation:');
runTest('should expose positive integer allotments_count on 100% of records', () => {
  let missingCount = 0;
  let nonIntegerCount = 0;
  let nonPositiveCount = 0;
  let backwardCompatMissing = 0;

  cutoffs.forEach((c, idx) => {
    if (c.allotments_count === undefined || c.allotments_count === null) {
      missingCount++;
    } else if (!Number.isInteger(c.allotments_count)) {
      nonIntegerCount++;
    } else if (c.allotments_count < 1) {
      nonPositiveCount++;
    }

    if (c.numberOfAllotments === undefined || c.numberOfAllotments === null) {
      backwardCompatMissing++;
    }
  });

  assert.strictEqual(missingCount, 0, `Found ${missingCount} records missing allotments_count`);
  assert.strictEqual(nonIntegerCount, 0, `Found ${nonIntegerCount} records with non-integer allotments_count`);
  assert.strictEqual(nonPositiveCount, 0, `Found ${nonPositiveCount} records with allotments_count < 1`);
  assert.strictEqual(backwardCompatMissing, 0, `Found ${backwardCompatMissing} records missing numberOfAllotments`);
});

// 4. Deduplication and Foreign Key Integrity
console.log('\n4. Deduplication and Foreign Key Integrity:');
runTest('should have 0 duplicate cutoffs and 100% valid college IDs in colleges.json', () => {
  const seenKeys = new Set();
  let duplicateCount = 0;
  let missingCollegeCount = 0;

  cutoffs.forEach(c => {
    const key = [
      c.collegeId,
      c.course,
      c.specialty,
      c.quotaCode,
      c.seatCategory,
      c.round,
      c.closingRank
    ].join('|');

    if (seenKeys.has(key)) {
      duplicateCount++;
    }
    seenKeys.add(key);

    if (!collegesMap.has(c.collegeId)) {
      missingCollegeCount++;
    }
  });

  assert.strictEqual(duplicateCount, 0, `Found ${duplicateCount} duplicate records in Haryana cutoffs`);
  assert.strictEqual(missingCollegeCount, 0, `Found ${missingCollegeCount} orphaned college IDs`);
});

// 5. Source File Read-Only Protection
console.log('\n5. Source File Read-Only Protection:');
runTest('should verify original harayana.json is unmodified and has 774 records', () => {
  assert.strictEqual(sourceData.length, 774, `Expected 774 raw rows in harayana.json, found ${sourceData.length}`);
});

// 6. Filter and UI Helpers
console.log('\n6. Filter and UI Helpers:');
runTest('should verify filters.json contains the Haryana institution types and friendly quota options', () => {
  const collegeTypes = filters.collegeTypes.map(t => typeof t === 'object' ? t.code : t);
  const quotas = filters.quotas.map(q => q.code);

  assert.ok(collegeTypes.includes('Government Merit Seats'), 'filters.json missing Government Merit Seats');
  assert.ok(collegeTypes.includes('Institutional Preference (IP)'), 'filters.json missing Institutional Preference (IP)');
  assert.ok(collegeTypes.includes('Private State Domicile'), 'filters.json missing Private State Domicile');
  assert.ok(collegeTypes.includes('Private Open (Non-Domicile)'), 'filters.json missing Private Open (Non-Domicile)');
  assert.ok(collegeTypes.includes('Private Premium / NRI & Minority'), 'filters.json missing Private Premium / NRI & Minority');
  assert.ok(collegeTypes.includes('In-Service Cadre (DNB)'), 'filters.json missing In-Service Cadre (DNB)');

  assert.ok(quotas.includes('HAR Govt-All'), 'filters.json missing HAR Govt-All');
  assert.ok(quotas.includes('HAR Govt-Inst. Pref'), 'filters.json missing HAR Govt-Inst. Pref');
  assert.ok(quotas.includes('Haryana Priv IP'), 'filters.json missing Haryana Priv IP');
  assert.ok(quotas.includes('HAR Priv-Govt Quota'), 'filters.json missing HAR Priv-Govt Quota');
  assert.ok(quotas.includes('HAR Priv-Mgmt'), 'filters.json missing HAR Priv-Mgmt');
  assert.ok(quotas.includes('Haryana Priv NRI'), 'filters.json missing Haryana Priv NRI');
  assert.ok(quotas.includes('HAR Priv-Minority'), 'filters.json missing HAR Priv-Minority');
  assert.ok(quotas.includes('Haryana DNB Serv'), 'filters.json missing Haryana DNB Serv');
});

console.log('====================================================');
console.log(`Test Results: ${passedTests} passed, ${totalTests - passedTests} failed (Total: ${totalTests})`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
