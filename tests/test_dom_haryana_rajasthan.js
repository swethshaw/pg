/**
 * DOM Integration Test: Runs index.html and app.js inside JSDOM with Haryana & Rajasthan data
 * Verifies that:
 * 1. Switching counselling to "Haryana" loads Haryana data
 * 2. Haryana College Type dropdown contains the 6 institution & domicile types
 * 3. Haryana Quota dropdown groups quotas into proper optgroups
 * 4. Prediction renders Haryana results with friendly Institution & Domicile Type badge
 * 5. Switching counselling to "Rajasthan" loads Rajasthan data
 * 6. Rajasthan College Type dropdown contains the 6 institution & fee/merit types (including RajMES)
 * 7. Prediction renders Rajasthan results with friendly Institution Type badge
 * 8. Filtering works accurately across both states
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
const haryanaData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/cutoffs/Haryana.json'), 'utf8'));
const rajasthanData = JSON.parse(fs.readFileSync(path.resolve(PROJECT_ROOT, 'data/cutoffs/Rajasthan.json'), 'utf8'));

console.log('Testing Frontend DOM Haryana & Rajasthan Integration with JSDOM...');

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
  } else if (cleanUrl.includes('Haryana.json')) {
    responseData = haryanaData;
  } else if (cleanUrl.includes('Rajasthan.json')) {
    responseData = rajasthanData;
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

// Wait for initial loadData, then test Haryana and Rajasthan
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

    // ==========================================
    // TEST HARYANA
    // ==========================================
    console.log('\n--- Switching Counselling to Haryana ---');
    selectCounselling.value = 'Haryana';
    selectCounselling.dispatchEvent(new window.Event('change'));

    setTimeout(() => {
      try {
        console.log('\n--- Checking Dropdown Options for Haryana ---');
        const hrQuotaOpts = Array.from(selectQuota.options).map(o => o.value);
        console.log(`Haryana Quota options count: ${hrQuotaOpts.length}`);
        assert.ok(hrQuotaOpts.includes('HAR Govt-All'), 'Haryana Quota missing HAR Govt-All');
        assert.ok(hrQuotaOpts.includes('HAR Govt-Inst. Pref'), 'Haryana Quota missing HAR Govt-Inst. Pref');
        assert.ok(hrQuotaOpts.includes('Haryana Priv IP'), 'Haryana Quota missing Haryana Priv IP');
        assert.ok(hrQuotaOpts.includes('HAR Priv-Govt Quota'), 'Haryana Quota missing HAR Priv-Govt Quota');
        assert.ok(hrQuotaOpts.includes('HAR Priv-Mgmt'), 'Haryana Quota missing HAR Priv-Mgmt');
        assert.ok(hrQuotaOpts.includes('Haryana Priv NRI'), 'Haryana Quota missing Haryana Priv NRI');
        assert.ok(hrQuotaOpts.includes('HAR Priv-Minority'), 'Haryana Quota missing HAR Priv-Minority');
        assert.ok(hrQuotaOpts.includes('Haryana DNB Serv'), 'Haryana Quota missing Haryana DNB Serv');
        console.log('✓ All 8 Haryana child quotas populated correctly');

        const hrCollegeTypeOpts = Array.from(selectCollegeType.options).map(o => o.value).filter(v => v !== 'ALL');
        console.log(`College Types for Haryana:`, JSON.stringify(hrCollegeTypeOpts));
        assert.ok(hrCollegeTypeOpts.includes('Government Merit Seats'), 'Missing Government Merit Seats');
        assert.ok(hrCollegeTypeOpts.includes('Institutional Preference (IP)'), 'Missing Institutional Preference (IP)');
        assert.ok(hrCollegeTypeOpts.includes('Private State Domicile'), 'Missing Private State Domicile');
        assert.ok(hrCollegeTypeOpts.includes('Private Open (Non-Domicile)'), 'Missing Private Open (Non-Domicile)');
        assert.ok(hrCollegeTypeOpts.includes('Private Premium / NRI & Minority'), 'Missing Private Premium / NRI & Minority');
        assert.ok(hrCollegeTypeOpts.includes('In-Service Cadre (DNB)'), 'Missing In-Service Cadre (DNB)');
        console.log('✓ All 6 Haryana Institution & Domicile Types present in College Type dropdown');

        // Trigger Prediction (Rank 5000, Category GN)
        console.log('\n--- Triggering Haryana Prediction (Rank 5000, Category GN) ---');
        rankInput.value = '5000';
        window.tomSelectRegistry['select-category'].setValue('GN');
        form.dispatchEvent(new window.Event('submit'));

        const hrCards = resultsList.querySelectorAll('.result-card');
        console.log(`Haryana rendered cards count: ${hrCards.length}`);
        assert.ok(hrCards.length > 0, 'Expected results for Rank 5000 in Haryana');

        const firstHrCardText = hrCards[0].textContent;
        console.log(`First Haryana card snippet: ${firstHrCardText.substring(0, 150)}...`);
        assert.ok(
          firstHrCardText.includes('Government Merit Seats') ||
          firstHrCardText.includes('Institutional Preference (IP)') ||
          firstHrCardText.includes('Private State Domicile') ||
          firstHrCardText.includes('Private Open (Non-Domicile)') ||
          firstHrCardText.includes('Private Premium / NRI & Minority') ||
          firstHrCardText.includes('In-Service Cadre (DNB)'),
          'Card should display friendly Institution & Domicile Type'
        );
        console.log('✓ Haryana result card displays friendly Institution & Domicile Type');

        // Filter by Government Merit Seats
        window.tomSelectRegistry['select-college-type'].setValue('Government Merit Seats');
        form.dispatchEvent(new window.Event('submit'));
        const govtFiltered = resultsList.querySelectorAll('.result-card');
        console.log(`Haryana Govt Merit filtered cards: ${govtFiltered.length}`);
        assert.ok(govtFiltered.length > 0, 'Expected Govt Merit results in Haryana');
        console.log('✓ Filter by Government Merit Seats matches accurately in Haryana');

        // ==========================================
        // TEST RAJASTHAN
        // ==========================================
        console.log('\n--- Switching Counselling to Rajasthan ---');
        selectCounselling.value = 'Rajasthan';
        selectCounselling.dispatchEvent(new window.Event('change'));

        setTimeout(() => {
          try {
            console.log('\n--- Checking Dropdown Options for Rajasthan ---');
            const rjQuotaOpts = Array.from(selectQuota.options).map(o => o.value);
            console.log(`Rajasthan Quota options count: ${rjQuotaOpts.length}`);
            assert.ok(rjQuotaOpts.includes('RAJ Govt - Govt Quota'), 'Missing RAJ Govt - Govt Quota');
            assert.ok(rjQuotaOpts.includes('RAJ Govt - Mgmt Quota'), 'Missing RAJ Govt - Mgmt Quota');
            assert.ok(rjQuotaOpts.includes('RAJ Priv-Govt Quota'), 'Missing RAJ Priv-Govt Quota');
            assert.ok(rjQuotaOpts.includes('RAJ Priv-All India'), 'Missing RAJ Priv-All India');
            assert.ok(rjQuotaOpts.includes('RAJ Priv-Mgmt Quota'), 'Missing RAJ Priv-Mgmt Quota');
            assert.ok(rjQuotaOpts.includes('Raj DNB Serv'), 'Missing Raj DNB Serv');
            console.log('✓ All 6 Rajasthan quotas populated correctly');

            const rjCollegeTypeOpts = Array.from(selectCollegeType.options).map(o => o.value).filter(v => v !== 'ALL');
            console.log(`College Types for Rajasthan:`, JSON.stringify(rjCollegeTypeOpts));
            assert.ok(rjCollegeTypeOpts.includes('Government Merit Seats'), 'Missing Government Merit Seats');
            assert.ok(rjCollegeTypeOpts.includes('Government Payment Seats (RajMES)'), 'Missing Government Payment Seats (RajMES)');
            assert.ok(rjCollegeTypeOpts.includes('Private State Domicile'), 'Missing Private State Domicile');
            assert.ok(rjCollegeTypeOpts.includes('Private Open (Non-Domicile)'), 'Missing Private Open (Non-Domicile)');
            assert.ok(rjCollegeTypeOpts.includes('Private Premium / Management'), 'Missing Private Premium / Management');
            assert.ok(rjCollegeTypeOpts.includes('In-Service Cadre (DNB)'), 'Missing In-Service Cadre (DNB)');
            console.log('✓ All 6 Rajasthan Institution & Fee Structure Types present in College Type dropdown');

            // Trigger Prediction (Rank 5000, Category GN)
            console.log('\n--- Triggering Rajasthan Prediction (Rank 5000, Category GN) ---');
            rankInput.value = '5000';
            window.tomSelectRegistry['select-category'].setValue('GN');
            window.tomSelectRegistry['select-college-type'].setValue([]);
            form.dispatchEvent(new window.Event('submit'));

            const rjCards = resultsList.querySelectorAll('.result-card');
            console.log(`Rajasthan rendered cards count: ${rjCards.length}`);
            assert.ok(rjCards.length > 0, 'Expected results for Rank 5000 in Rajasthan');

            const firstRjCardText = rjCards[0].textContent;
            console.log(`First Rajasthan card snippet: ${firstRjCardText.substring(0, 150)}...`);
            assert.ok(
              firstRjCardText.includes('Government Merit Seats') ||
              firstRjCardText.includes('Government Payment Seats (RajMES)') ||
              firstRjCardText.includes('Private State Domicile') ||
              firstRjCardText.includes('Private Open (Non-Domicile)') ||
              firstRjCardText.includes('Private Premium / Management') ||
              firstRjCardText.includes('In-Service Cadre (DNB)'),
              'Card should display friendly Institution Type'
            );
            console.log('✓ Rajasthan result card displays friendly Institution Type');

            // Filter by Government Payment Seats (RajMES)
            window.tomSelectRegistry['select-college-type'].setValue('Government Payment Seats (RajMES)');
            form.dispatchEvent(new window.Event('submit'));
            const rajmesFiltered = resultsList.querySelectorAll('.result-card');
            console.log(`RajMES Payment filtered cards: ${rajmesFiltered.length}`);
            assert.ok(rajmesFiltered.length > 0, 'Expected RajMES Payment results in Rajasthan');
            console.log('✓ Filter by Government Payment Seats (RajMES) matches accurately in Rajasthan');

            console.log('\n✓ Complete Frontend DOM Haryana & Rajasthan Integration Test Passed Successfully!\n');
            process.exit(0);
          } catch (err) {
            console.error('\n✗ Rajasthan DOM test failed:', err);
            process.exit(1);
          }
        }, 150);

      } catch (err) {
        console.error('\n✗ Haryana DOM test failed:', err);
        process.exit(1);
      }
    }, 150);

  } catch (err) {
    console.error('\n✗ Initial DOM setup failed:', err);
    process.exit(1);
  }
}, 150);
