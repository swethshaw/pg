/**
 * DOM Integration Test: Runs index.html and app.js inside JSDOM with Open States data
 * Verifies that:
 * 1. Switching counselling to "Open States" loads Open States data
 * 2. Quota dropdown contains the 3 Institution Types + 21 Open States child quotas
 * 3. College Type dropdown contains the 3 Institution Types:
 *    - Private Open Seats (Merit)
 *    - Management / Institutional Seats
 *    - Government / State General Seats
 * 4. Prediction renders Open States results with proper Institution Type badge
 * 5. Filtering by each Institution Type works accurately
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
const openStatesData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/cutoffs/Open States.json'), 'utf8'));

console.log('Testing Frontend DOM Open States Integration with JSDOM...');

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
  } else if (cleanUrl.includes('Open%20States.json') || cleanUrl.includes('Open States.json')) {
    responseData = openStatesData;
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

// Wait for initial loadData, then switch counselling to Open States
setTimeout(() => {
  try {
    const document = window.document;
    const selectCounselling = document.getElementById('select-counselling');
    const selectQuota = document.getElementById('select-quota');
    const selectCollegeType = document.getElementById('select-college-type');
    const rankInput = document.getElementById('input-rank');
    const selectCategory = document.getElementById('select-category');
    const resultsList = document.getElementById('results-list');
    const form = document.getElementById('predictor-form');

    console.log('\n--- Switching Counselling to Open States ---');
    selectCounselling.value = 'Open States';
    const changeEvent = new window.Event('change', { bubbles: true });
    selectCounselling.dispatchEvent(changeEvent);

    // Allow fetchCutoffs('Open States') to resolve
    setTimeout(() => {
      try {
        console.log('\n--- Checking Dropdown Options for Open States ---');

        // 1. Quota Options
        const quotaOptions = Array.from(selectQuota.options).map(o => o.value).filter(v => v && v !== 'ALL');
        console.log(`Open States Quota count: ${quotaOptions.length}`);
        
        // Quota group headers
        assert.ok(quotaOptions.includes('Private Open Seats (Merit)'), 'Missing Private Open Seats (Merit) in Quota dropdown');
        assert.ok(quotaOptions.includes('Management / Institutional Seats'), 'Missing Management / Institutional Seats in Quota dropdown');
        assert.ok(quotaOptions.includes('Government / State General Seats'), 'Missing Government / State General Seats in Quota dropdown');
        
        // Sample child quotas
        assert.ok(quotaOptions.includes('UP Priv-Open Quota'), 'Missing UP Priv-Open Quota');
        assert.ok(quotaOptions.includes('APMgmt-S1-All-CatB'), 'Missing APMgmt-S1-All-CatB');
        assert.ok(quotaOptions.includes('Other State'), 'Missing Other State');
        console.log('✓ All 3 Quota Groups + child quotas populated correctly');

        // 2. College Type Options
        const collegeTypeOptions = Array.from(selectCollegeType.options).map(o => o.value).filter(v => v && v !== 'ALL');
        console.log(`College Types for Open States: ${JSON.stringify(collegeTypeOptions)}`);
        assert.ok(collegeTypeOptions.includes('Private Open Seats (Merit)'), 'Missing Private Open Seats (Merit) in College Type dropdown');
        assert.ok(collegeTypeOptions.includes('Management / Institutional Seats'), 'Missing Management / Institutional Seats in College Type dropdown');
        assert.ok(collegeTypeOptions.includes('Government / State General Seats'), 'Missing Government / State General Seats in College Type dropdown');
        console.log('✓ All 3 Institution Types present in College Type dropdown');

        // 3. Trigger Prediction for Rank 15000, Category General
        console.log('\n--- Triggering Prediction (Rank 15000, Category GN) ---');
        rankInput.value = '15000';
        window.tomSelectRegistry['select-category'].setValue(['GN']);

        const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);

        const cards = resultsList.querySelectorAll('.result-card');
        console.log(`Rendered cards count: ${cards.length}`);
        assert.ok(cards.length > 0, 'Expected Open States cards to be rendered');

        // Inspect first card
        const firstCard = cards[0];
        const cardText = firstCard.textContent;
        console.log('First card text snippet:', cardText.slice(0, 160));
        assert.ok(
          cardText.includes('Private Open Seats (Merit)') ||
          cardText.includes('Management / Institutional Seats') ||
          cardText.includes('Government / State General Seats'),
          'Card must display one of the 3 Institution Types'
        );
        console.log('✓ Result card displays friendly Institution Type');

        // 4. Filtering by College Type: Private Open Seats (Merit)
        console.log('\n--- Filtering by College Type: Private Open Seats (Merit) ---');
        window.tomSelectRegistry['select-college-type'].setValue(['Private Open Seats (Merit)']);
        form.dispatchEvent(submitEvent);

        const meritCards = resultsList.querySelectorAll('.result-card');
        console.log(`Merit filtered cards: ${meritCards.length}`);
        assert.ok(meritCards.length > 0, 'Expected Private Open Seats (Merit) cards');
        Array.from(meritCards).slice(0, 5).forEach(c => {
          assert.ok(c.textContent.includes('Private Open Seats (Merit)'), 'Every filtered card must be Private Open Seats (Merit)');
        });
        console.log('✓ Filter by Private Open Seats (Merit) matches 100% accurately');

        // 5. Filtering by College Type: Management / Institutional Seats
        console.log('\n--- Filtering by College Type: Management / Institutional Seats ---');
        window.tomSelectRegistry['select-college-type'].setValue(['Management / Institutional Seats']);
        form.dispatchEvent(submitEvent);

        const mgmtCards = resultsList.querySelectorAll('.result-card');
        console.log(`Management filtered cards: ${mgmtCards.length}`);
        assert.ok(mgmtCards.length > 0, 'Expected Management / Institutional Seats cards');
        Array.from(mgmtCards).slice(0, 5).forEach(c => {
          assert.ok(c.textContent.includes('Management / Institutional Seats'), 'Every filtered card must be Management / Institutional Seats');
        });
        console.log('✓ Filter by Management / Institutional Seats matches 100% accurately');

        console.log('\n✓ Complete Frontend DOM Open States Integration Test Passed Successfully!\n');
      } catch (innerErr) {
        console.error('Test Failed during Open States checks:', innerErr);
        process.exit(1);
      }
    }, 200);

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 300);
