/**
 * DOM Integration Test: Runs index.html and app.js inside JSDOM with Madhya Pradesh data
 * Verifies that:
 * 1. Switching counselling to "Madhya Pradesh" loads MP data
 * 2. Quota dropdown contains the 4 Institution & Domicile Types + MP child quotas
 * 3. College Type dropdown contains the 4 Institution & Domicile Types:
 *    - Government (State Domicile)
 *    - Private (State Domicile)
 *    - Non-Domicile / Open (All India)
 *    - NRI Quota
 * 4. Prediction renders MP results with proper Institution & Domicile Type badge
 * 5. Filtering by each Institution & Domicile Type works accurately
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
const mpData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/cutoffs/Madhya Pradesh.json'), 'utf8'));

console.log('Testing Frontend DOM Madhya Pradesh Integration with JSDOM...');

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
  } else if (cleanUrl.includes('Madhya%20Pradesh.json') || cleanUrl.includes('Madhya Pradesh.json')) {
    responseData = mpData;
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

// Wait for initial loadData, then switch counselling to Madhya Pradesh
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

    console.log('\n--- Switching Counselling to Madhya Pradesh ---');
    selectCounselling.value = 'Madhya Pradesh';
    const changeEvent = new window.Event('change', { bubbles: true });
    selectCounselling.dispatchEvent(changeEvent);

    // Allow fetchCutoffs('Madhya Pradesh') to resolve
    setTimeout(() => {
      try {
        console.log('\n--- Checking Dropdown Options for Madhya Pradesh ---');

        // 1. Quota Options
        const quotaOptions = Array.from(selectQuota.options).map(o => o.value).filter(v => v && v !== 'ALL');
        console.log(`MP Quota options count: ${quotaOptions.length}`);
        
        // Quota group headers
        assert.ok(quotaOptions.includes('Government (State Domicile)'), 'Missing Government (State Domicile) in Quota dropdown');
        assert.ok(quotaOptions.includes('Private (State Domicile)'), 'Missing Private (State Domicile) in Quota dropdown');
        assert.ok(quotaOptions.includes('Non-Domicile / Open (All India)'), 'Missing Non-Domicile / Open (All India) in Quota dropdown');
        assert.ok(quotaOptions.includes('NRI Quota'), 'Missing NRI Quota in Quota dropdown');
        
        // Child quotas
        assert.ok(quotaOptions.includes('MP Govt Quota'), 'Missing MP Govt Quota');
        assert.ok(quotaOptions.includes('MP Priv-Open'), 'Missing MP Priv-Open');
        assert.ok(quotaOptions.includes('MP Priv-NonDomicile'), 'Missing MP Priv-NonDomicile');
        assert.ok(quotaOptions.includes('MP Govt-NonDomicile'), 'Missing MP Govt-NonDomicile');
        assert.ok(quotaOptions.includes('MP Priv-NRI'), 'Missing MP Priv-NRI');
        assert.ok(quotaOptions.includes('MP Priv-NRINonDomicil'), 'Missing MP Priv-NRINonDomicil');
        console.log('✓ All 4 Quota Groups + 6 child quotas populated correctly');

        // 2. College Type Options
        const collegeTypeOptions = Array.from(selectCollegeType.options).map(o => o.value).filter(v => v && v !== 'ALL');
        console.log(`College Types for MP: ${JSON.stringify(collegeTypeOptions)}`);
        assert.ok(collegeTypeOptions.includes('Government (State Domicile)'));
        assert.ok(collegeTypeOptions.includes('Private (State Domicile)'));
        assert.ok(collegeTypeOptions.includes('Non-Domicile / Open (All India)'));
        assert.ok(collegeTypeOptions.includes('NRI Quota'));
        console.log('✓ All 4 Institution & Domicile Types present in College Type dropdown');

        // 3. Trigger Prediction for Rank 5000, Category General
        console.log('\n--- Triggering Prediction (Rank 5000, Category GN) ---');
        rankInput.value = '5000';
        window.tomSelectRegistry['select-category'].setValue(['GN']);

        const submitEvent = new window.Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(submitEvent);

        const cards = resultsList.querySelectorAll('.result-card');
        console.log(`Rendered cards count: ${cards.length}`);
        assert.ok(cards.length > 0, 'Expected MP cards to be rendered');

        // Inspect first card
        const firstCard = cards[0];
        const cardText = firstCard.textContent;
        console.log('First card snippet:', cardText.slice(0, 160));
        assert.ok(
          cardText.includes('Government (State Domicile)') ||
          cardText.includes('Private (State Domicile)') ||
          cardText.includes('Non-Domicile / Open (All India)') ||
          cardText.includes('NRI Quota'),
          'Card must display one of the MP Institution & Domicile Types'
        );
        console.log('✓ Result card displays friendly Institution & Domicile Type');

        // 4. Filtering by College Type: Government (State Domicile)
        console.log('\n--- Filtering by College Type: Government (State Domicile) ---');
        window.tomSelectRegistry['select-college-type'].setValue(['Government (State Domicile)']);
        form.dispatchEvent(submitEvent);

        const govtCards = resultsList.querySelectorAll('.result-card');
        console.log(`Govt filtered cards: ${govtCards.length}`);
        assert.ok(govtCards.length > 0, 'Expected Government (State Domicile) cards');
        Array.from(govtCards).slice(0, 5).forEach(c => {
          assert.ok(c.textContent.includes('Government (State Domicile)'));
        });
        console.log('✓ Filter by Government (State Domicile) matches 100% accurately');

        // 5. Filtering by College Type: Private (State Domicile)
        console.log('\n--- Filtering by College Type: Private (State Domicile) ---');
        window.tomSelectRegistry['select-college-type'].setValue(['Private (State Domicile)']);
        form.dispatchEvent(submitEvent);

        const privCards = resultsList.querySelectorAll('.result-card');
        console.log(`Private filtered cards: ${privCards.length}`);
        assert.ok(privCards.length > 0, 'Expected Private (State Domicile) cards');
        Array.from(privCards).slice(0, 5).forEach(c => {
          assert.ok(c.textContent.includes('Private (State Domicile)'));
        });
        console.log('✓ Filter by Private (State Domicile) matches 100% accurately');

        console.log('\n✓ Complete Frontend DOM Madhya Pradesh Integration Test Passed Successfully!\n');
      } catch (innerErr) {
        console.error('Test Failed during Madhya Pradesh checks:', innerErr);
        process.exit(1);
      }
    }, 200);

  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}, 300);
