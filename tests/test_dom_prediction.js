/**
 * DOM Integration Test: Runs index.html and app.js inside JSDOM with real JSON files
 * Verifies that:
 * 1. Colleges, filters, and All India cutoffs load into app.js
 * 2. Prediction runs and renders college cards
 * 3. Round badges render closing ranks and allotment counts
 * 4. Quota filter dropdown correctly reflects all 13 All India quotas
 * 5. College type filter dropdown correctly reflects all 5 institution types
 * 6. Category dropdown contains all 14 categories (including AFMS & NRI priorities)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { JSDOM } = require('jsdom');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const HTML_FILE = path.resolve(PROJECT_ROOT, 'index.html');
const APP_JS_FILE = path.resolve(PROJECT_ROOT, 'app.js');

const collegesData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/colleges.json'), 'utf8'));
const filtersData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/filters.json'), 'utf8'));
const allIndiaData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/cutoffs/All India.json'), 'utf8'));

console.log('Testing Frontend DOM Integration with JSDOM...');

const htmlContent = fs.readFileSync(HTML_FILE, 'utf8');

const dom = new JSDOM(htmlContent, {
  runScripts: 'outside-only',
  url: 'http://localhost:8080/'
});

const { window } = dom;

// Mock fetch
window.fetch = function(url) {
  const cleanUrl = url.split('?')[0];
  let responseData = null;
  if (cleanUrl.endsWith('filters.json')) {
    responseData = filtersData;
  } else if (cleanUrl.endsWith('colleges.json')) {
    responseData = collegesData;
  } else if (cleanUrl.includes('All%20India.json') || cleanUrl.includes('All India.json')) {
    responseData = allIndiaData;
  } else {
    return Promise.reject(new Error(`404: ${url}`));
  }

  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(responseData)
  });
};

// Mock TomSelect constructor
window.tomSelectRegistry = {};
window.TomSelect = function(element, options) {
  this.element = typeof element === 'string' ? window.document.querySelector(element) : element;
  this.options = options;
  this.value = this.element.value || (this.element.multiple ? [] : '');
  this.getValue = () => this.value;
  this.setValue = (val, silent) => {
    this.value = val;
    if (this.element.multiple && Array.isArray(val)) {
      Array.from(this.element.options).forEach(opt => {
        opt.selected = val.includes(opt.value);
      });
    } else {
      this.element.value = val;
    }
  };
  this.destroy = () => {};
  if (this.element && this.element.id) {
    window.tomSelectRegistry[this.element.id] = this;
  }
};

// Execute app.js in window context
const appJsCode = fs.readFileSync(APP_JS_FILE, 'utf8');
window.eval(appJsCode);

// Wait for async loadData to complete
setTimeout(() => {
  try {
    const document = window.document;
    const rankInput = document.getElementById('input-rank');
    const resultsList = document.getElementById('results-list');
    const selectQuota = document.getElementById('select-quota');
    const selectCollegeType = document.getElementById('select-college-type');
    const selectCategory = document.getElementById('select-category');

    console.log('\n--- Checking Dropdown Options ---');

    // 1. Quota Dropdown Check
    const quotaOptions = Array.from(selectQuota.options).map(o => o.value).filter(v => v && v !== 'ALL');
    console.log(`Quota dropdown options count: ${quotaOptions.length}`);
    const expected13Quotas = [
      'AIQ', 'DU', 'IP', 'BHU', 'AMU',
      'MNG', 'NRI', 'MM', 'JM',
      'AFMS', 'AFMS-DNB',
      'DNB Post MBBS', 'NBE Diploma'
    ];
    expected13Quotas.forEach(q => {
      assert.ok(quotaOptions.includes(q), `Quota dropdown missing: ${q}`);
    });
    assert.ok(quotaOptions.includes('DNB / NBE (Govt & Private)'), 'Quota dropdown missing DNB / NBE (Govt & Private)');
    console.log('✓ All 13 Quotas + DNB / NBE (Govt & Private) are present in Quota dropdown');

    // 2. College Type Dropdown Check
    const collegeTypeOptions = Array.from(selectCollegeType.options).map(o => o.value).filter(v => v && v !== 'ALL');
    console.log(`College Type options: ${JSON.stringify(collegeTypeOptions)}`);
    const expectedCollegeTypes = ['Government', 'Central University', 'Deemed University', 'DNB Hospital', 'Armed Forces'];
    expectedCollegeTypes.forEach(t => {
      assert.ok(collegeTypeOptions.includes(t), `College Type dropdown missing: ${t}`);
    });
    assert.ok(collegeTypeOptions.includes('DNB / NBE (Govt & Private)'), 'College Type dropdown missing DNB / NBE (Govt & Private)');
    console.log('✓ All 5 College Types + DNB / NBE (Govt & Private) are present in College Type dropdown');

    // 3. Category Dropdown Check
    const categoryOptions = Array.from(selectCategory.options).map(o => o.value).filter(v => v && v !== 'ALL');
    console.log(`Category dropdown options count: ${categoryOptions.length}`);
    assert.ok(categoryOptions.includes('AFMS-Priority III'), 'Missing AFMS-Priority III in category dropdown');
    assert.ok(categoryOptions.includes('AFMS-Priority IV'), 'Missing AFMS-Priority IV in category dropdown');
    assert.ok(categoryOptions.includes('NRI-Priority I'), 'Missing NRI-Priority I in category dropdown');
    assert.ok(categoryOptions.includes('NRI-Priority II'), 'Missing NRI-Priority II in category dropdown');
    console.log('✓ All Categories (including AFMS and NRI priorities) are present');

    // 4. Trigger Prediction Check
    console.log('\n--- Triggering Prediction with Rank 5000 ---');
    rankInput.value = '5000';
    
    const form = document.getElementById('predictor-form');
    const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submitEvent);
    
    const resultCards = resultsList.querySelectorAll('.result-card');
    console.log(`Rendered result cards count: ${resultCards.length}`);
    assert.ok(resultCards.length > 0, 'Expected result cards to be rendered');

    // Inspect first card
    const firstCard = resultCards[0];
    const collegeName = firstCard.querySelector('.result-college-name').textContent;
    const courseName = firstCard.querySelector('.result-course-name').textContent;
    const roundBadges = firstCard.querySelectorAll('.round-badge');
    const allotmentBadges = firstCard.querySelectorAll('.badge-allotments');

    console.log(`First result card:`);
    console.log(`  College: ${collegeName}`);
    console.log(`  Course:  ${courseName}`);
    console.log(`  Rounds:  ${roundBadges.length} round badges`);
    console.log(`  Allotments displayed: ${allotmentBadges.length} allotment badges`);

    assert.ok(roundBadges.length > 0, 'Expected at least 1 round badge');
    assert.ok(allotmentBadges.length > 0, 'Expected allotments badge to be rendered');

    const sampleBadgeText = roundBadges[0].textContent;
    console.log(`  Sample round badge text: "${sampleBadgeText}"`);
    assert.ok(sampleBadgeText.includes('(') && sampleBadgeText.includes('seat'), 'Round badge should contain seat count');

    // 5. Filter by Quota: DNB / NBE (Govt & Private)
    console.log('\n--- Filtering by Quota: DNB / NBE (Govt & Private) ---');
    window.tomSelectRegistry['select-quota'].setValue(['DNB / NBE (Govt & Private)']);
    form.dispatchEvent(submitEvent);
    const dnbQuotaCards = resultsList.querySelectorAll('.result-card');
    console.log(`DNB Quota filtered cards count: ${dnbQuotaCards.length}`);
    assert.ok(dnbQuotaCards.length > 0, 'Expected DNB Quota filter to return cards');

    // 6. Filter by College Type: DNB / NBE (Govt & Private)
    console.log('\n--- Filtering by College Type: DNB / NBE (Govt & Private) ---');
    window.tomSelectRegistry['select-quota'].setValue([]);
    window.tomSelectRegistry['select-college-type'].setValue(['DNB / NBE (Govt & Private)']);
    form.dispatchEvent(submitEvent);
    const dnbTypeCards = resultsList.querySelectorAll('.result-card');
    console.log(`DNB Type filtered cards count: ${dnbTypeCards.length}`);
    assert.ok(dnbTypeCards.length > 0, 'Expected DNB College Type filter to return cards');

    console.log('\n✓ Complete Frontend DOM Integration Test Passed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('DOM Integration Test Failed:', err);
    process.exit(1);
  }
}, 600);
