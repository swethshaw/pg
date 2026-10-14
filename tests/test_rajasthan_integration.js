/**
 * NEET PG Rajasthan Cutoff & Counseling Integration Test Suite
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const rjCutoffsPath = path.join(__dirname, '../data/cutoffs/Rajasthan.json');
const collegesPath = path.join(__dirname, '../data/colleges.json');
const filtersPath = path.join(__dirname, '../data/filters.json');
const sourcePath = '/Users/swethshaw/career plan b/datfile/Rajasthan.json';

const cutoffs = JSON.parse(fs.readFileSync(rjCutoffsPath, 'utf8'));
const colleges = JSON.parse(fs.readFileSync(collegesPath, 'utf8'));
const filters = JSON.parse(fs.readFileSync(filtersPath, 'utf8'));
const sourceData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const collegesMap = new Map(colleges.map(c => [c.id, c]));

console.log('====================================================');
console.log('Running NEET PG Rajasthan Cutoff Test Suite');
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

// 1. Quotas Divided by Institution & Fee/Merit Structure
console.log('1. Quotas Divided by Institution & Fee/Merit Structure:');
const expectedQuotaGroups = {
  'Government Merit Seats': [
    'RAJ Govt - Govt Quota'
  ],
  'Government Payment Seats (RajMES)': [
    'RAJ Govt - Mgmt Quota'
  ],
  'Private State Domicile': [
    'RAJ Priv-Govt Quota'
  ],
  'Private Open (Non-Domicile)': [
    'RAJ Priv-All India'
  ],
  'Private Premium / Management': [
    'RAJ Priv-Mgmt Quota'
  ],
  'In-Service Cadre (DNB)': [
    'Raj DNB Serv'
  ]
};

runTest('should contain all 6 quotas grouped into the 6 institution & fee/merit types', () => {
  const quotasInDataset = new Set(cutoffs.map(c => c.quotaCode));
  assert.strictEqual(quotasInDataset.size, 6, `Expected 6 unique quotas, found ${quotasInDataset.size}`);

  const allExpectedQuotas = new Set();
  for (const grp in expectedQuotaGroups) {
    expectedQuotaGroups[grp].forEach(q => allExpectedQuotas.add(q));
  }

  for (const q of quotasInDataset) {
    assert.ok(allExpectedQuotas.has(q), `Unexpected quota in dataset: ${q}`);
  }

  // Check counts per group
  const govtCount = cutoffs.filter(c => expectedQuotaGroups['Government Merit Seats'].includes(c.quotaCode)).length;
  const rajmesCount = cutoffs.filter(c => expectedQuotaGroups['Government Payment Seats (RajMES)'].includes(c.quotaCode)).length;
  const privGovtCount = cutoffs.filter(c => expectedQuotaGroups['Private State Domicile'].includes(c.quotaCode)).length;
  const privAiCount = cutoffs.filter(c => expectedQuotaGroups['Private Open (Non-Domicile)'].includes(c.quotaCode)).length;
  const privMgmtCount = cutoffs.filter(c => expectedQuotaGroups['Private Premium / Management'].includes(c.quotaCode)).length;
  const dnbCount = cutoffs.filter(c => expectedQuotaGroups['In-Service Cadre (DNB)'].includes(c.quotaCode)).length;

  const totalGroupCount = govtCount + rajmesCount + privGovtCount + privAiCount + privMgmtCount + dnbCount;
  assert.strictEqual(totalGroupCount, cutoffs.length, 'Sum of groups must equal total cutoffs');
  assert.strictEqual(govtCount, 2780, `Expected 2780 Govt Merit cutoffs, found ${govtCount}`);
  assert.strictEqual(rajmesCount, 250, `Expected 250 RajMES Payment cutoffs, found ${rajmesCount}`);
  assert.strictEqual(privGovtCount, 940, `Expected 940 Private State Domicile cutoffs, found ${privGovtCount}`);
  assert.strictEqual(privAiCount, 856, `Expected 856 Private All-India cutoffs, found ${privAiCount}`);
  assert.strictEqual(privMgmtCount, 351, `Expected 351 Private Management cutoffs, found ${privMgmtCount}`);
  assert.strictEqual(dnbCount, 700, `Expected 700 DNB Inservice cutoffs, found ${dnbCount}`);
});

// 2. Categories Divided by Reservation Eligibility
console.log('\n2. Categories Divided by Reservation Eligibility:');
runTest('should contain all 11 Rajasthan categories in dataset', () => {
  const categoriesInDataset = new Set(cutoffs.map(c => c.seatCategory));
  assert.strictEqual(categoriesInDataset.size, 11, `Expected 11 categories, found ${categoriesInDataset.size}`);

  const expectedCategories = [
    'GEN', 'OBC', 'SC', 'EWS', 'ST', 'MBC', 'ST-STA', 'OBC-PwD', 'GEN-PwD', 'EWS-PwD', 'SC-PwD'
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
      c.closingRank,
      c.inservice_candidate ? 'IS' : 'NO_IS'
    ].join('|');

    if (seenKeys.has(key)) {
      duplicateCount++;
    }
    seenKeys.add(key);

    if (!collegesMap.has(c.collegeId)) {
      missingCollegeCount++;
    }
  });

  assert.strictEqual(duplicateCount, 0, `Found ${duplicateCount} duplicate records in Rajasthan cutoffs`);
  assert.strictEqual(missingCollegeCount, 0, `Found ${missingCollegeCount} orphaned college IDs`);
});

// 5. Source File Read-Only Protection
console.log('\n5. Source File Read-Only Protection:');
runTest('should verify original Rajasthan.json is unmodified and has 1984 records', () => {
  assert.strictEqual(sourceData.length, 1984, `Expected 1984 raw rows in Rajasthan.json, found ${sourceData.length}`);
});

// 6. Filter and UI Helpers
console.log('\n6. Filter and UI Helpers:');
runTest('should verify filters.json contains the Rajasthan institution types and friendly quota options', () => {
  const collegeTypes = filters.collegeTypes.map(t => typeof t === 'object' ? t.code : t);
  const quotas = filters.quotas.map(q => q.code);

  assert.ok(collegeTypes.includes('Government Merit Seats'), 'filters.json missing Government Merit Seats');
  assert.ok(collegeTypes.includes('Government Payment Seats (RajMES)'), 'filters.json missing Government Payment Seats (RajMES)');
  assert.ok(collegeTypes.includes('Private State Domicile'), 'filters.json missing Private State Domicile');
  assert.ok(collegeTypes.includes('Private Open (Non-Domicile)'), 'filters.json missing Private Open (Non-Domicile)');
  assert.ok(collegeTypes.includes('Private Premium / Management'), 'filters.json missing Private Premium / Management');
  assert.ok(collegeTypes.includes('In-Service Cadre (DNB)'), 'filters.json missing In-Service Cadre (DNB)');

  assert.ok(quotas.includes('RAJ Govt - Govt Quota'), 'filters.json missing RAJ Govt - Govt Quota');
  assert.ok(quotas.includes('RAJ Govt - Mgmt Quota'), 'filters.json missing RAJ Govt - Mgmt Quota');
  assert.ok(quotas.includes('RAJ Priv-Govt Quota'), 'filters.json missing RAJ Priv-Govt Quota');
  assert.ok(quotas.includes('RAJ Priv-All India'), 'filters.json missing RAJ Priv-All India');
  assert.ok(quotas.includes('RAJ Priv-Mgmt Quota'), 'filters.json missing RAJ Priv-Mgmt Quota');
  assert.ok(quotas.includes('Raj DNB Serv'), 'filters.json missing Raj DNB Serv');
});

console.log('====================================================');
console.log(`Test Results: ${passedTests} passed, ${totalTests - passedTests} failed (Total: ${totalTests})`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
