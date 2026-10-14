/* ============================================================
   NEET PG 2025 MCC College Predictor — Application Logic
   ============================================================ */
(function () {
  'use strict';

  // ---- Constants ----
  var PAGE_SIZE = 25;
  var BAND_ORDER = { 'strong': 0, 'possible': 1, 'reach': 2, 'outside': 3 };

  // Quota code → friendly label (populated from filters.json)
  var QUOTA_LABELS = {};

  // Category eligibility: which seat categories can a candidate see?
  // Category eligibility: which seat categories can a candidate see?
  var CATEGORY_ELIGIBILITY = {
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

  // Open States Quotas by Institution Type
  var OPEN_STATES_QUOTA_GROUPS = {
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

  // Open States Categories by Reservation Type
  var OPEN_COMPETITION_CATEGORIES = [
    'UR', 'GEN', 'OPN', 'AGE', 'UR-GEN', 'UR/X/OP', 'UR (Non Domicile)', 'UR-Female', 'GN'
  ];
  var MANAGEMENT_CATEGORIES = [
    'MNG', 'MQ', 'MQ1', 'S1A', 'UR-MNG'
  ];
  var SOCIAL_GENDER_CATEGORIES = {
    'OBC': ['OBC', 'OBC-Female', 'BC'],
    'SC': ['SC', 'SC-Female'],
    'ST': ['ST', 'ST-Female']
  };

  // Madhya Pradesh Quotas by Institution & Domicile Type
  var MP_QUOTA_GROUPS = {
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

  // Haryana Quotas by Institution & Domicile Type
  var HARYANA_QUOTA_GROUPS = {
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

  // Rajasthan Quotas by Institution & Fee/Merit Structure
  var RAJASTHAN_QUOTA_GROUPS = {
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

  var USER_CATEGORIES = [
    { code: 'GN', label: 'General (UR)' },
    { code: 'EW', label: 'EWS' },
    { code: 'BC', label: 'OBC' },
    { code: 'BCA', label: 'BCA (Haryana Block A)' },
    { code: 'BCB', label: 'BCB (Haryana Block B)' },
    { code: 'MBC', label: 'MBC (Rajasthan Most Backward)' },
    { code: 'SC', label: 'SC' },
    { code: 'SCD', label: 'SCD (Haryana Deprived SC)' },
    { code: 'ST', label: 'ST' },
    { code: 'ST-STA', label: 'ST-STA (Rajasthan Tribal Sub-Plan)' },
    { code: 'GN PwD', label: 'General PwD' },
    { code: 'EW PwD', label: 'EWS PwD' },
    { code: 'BC PwD', label: 'OBC PwD' },
    { code: 'SC PwD', label: 'SC PwD' },
    { code: 'ST PwD', label: 'ST PwD' },
    { code: 'UR-Service', label: 'In-Service General (UR)' },
    { code: 'OBC-Service', label: 'In-Service OBC' },
    { code: 'BCA-Service', label: 'In-Service BCA (Haryana)' },
    { code: 'BCB-Service', label: 'In-Service BCB (Haryana)' },
    { code: 'SC-Service', label: 'In-Service SC' },
    { code: 'SCD-Service', label: 'In-Service SCD (Haryana)' },
    { code: 'ST-Service', label: 'In-Service ST' },
    { code: 'EWS-Service', label: 'In-Service EWS' },
    { code: 'IP', label: 'Institutional Preference (IP - Haryana)' },
    { code: 'AFMS-Priority III', label: 'AFMS Priority III' },
    { code: 'AFMS-Priority IV', label: 'AFMS Priority IV' },
    { code: 'NRI-Priority I', label: 'NRI Priority I' },
    { code: 'NRI-Priority II', label: 'NRI Priority II' }
  ];

  // Non-Clinical specialties: Pre-Clinical, Para-Clinical, Community & Public Health, Administration
  var NON_CLINICAL_SPECIALTIES = [
    // Pre-Clinical
    'Anatomy', 'Physiology', 'Bio-Chemistry', 'Biochemistry',
    // Para-Clinical (Pathology & Lab)
    'Pathology', 'Clinical Pathology', 'Microbiology', 'Pharmacology', 'Forensic Medicine',
    'Immuno Haematology & Blood Transfusion', 'Immuno Hematology & Transfusion Medicine',
    'Immuno-Haematology and Blood Transfusion', 'Lab Medicine',
    // Community & Public Health
    'Social & Preventive Medicine', 'Public Health', 'Master of Public Health (Epidemiology)',
    // Administration
    'Hospital Administration', 'Community Health Administration', 'Health Administration',
    'Health Administration including Hospital Administration'
  ];

  function getBranchType(specialty) {
    if (!specialty) return 'Other';
    if (NON_CLINICAL_SPECIALTIES.indexOf(specialty) !== -1) return 'Non-Clinical';
    return 'Clinical';
  }

  // ---- Application State ----
  var filtersData = null;
  var collegesMap = null;     // Map: collegeId → college object
  var cutoffsData = null;     // Array of cutoff records
  var currentUserRank = null;
  var currentCategory = '';
  var currentResults = [];    // Filtered + sorted results
  var currentPage = 1;
  var totalPages = 1;
  var searchTerm = '';
  
  var tomSelectInstances = {};

  function setSelectValue(selectEl, val, silent) {
    if (tomSelectInstances[selectEl.id]) {
      tomSelectInstances[selectEl.id].setValue(val, silent);
    } else {
      if (selectEl.multiple && Array.isArray(val)) {
        Array.prototype.slice.call(selectEl.options).forEach(function(opt) {
          opt.selected = val.indexOf(opt.value) !== -1;
        });
      } else {
        selectEl.value = val;
      }
    }
  }
  var currentUserRank = null;
  var currentCategory = '';
  var currentResults = [];    // Filtered + sorted results
  var currentPage = 1;
  var totalPages = 1;
  var searchTerm = '';

  // ---- DOM Cache ----
  var dom = {};

  function cacheDom() {
    // Form
    dom.form = document.getElementById('predictor-form');
    dom.themeToggle = document.getElementById('theme-toggle');
    dom.inputRank = document.getElementById('input-rank');
    dom.selectCategory = document.getElementById('select-category');
    dom.selectCounselling = document.getElementById('select-counselling');
    dom.selectState = document.getElementById('select-state');
    dom.selectQuota = document.getElementById('select-quota');
    dom.selectCourse = document.getElementById('select-course');
    dom.selectBranchType = document.getElementById('select-branch-type');
    dom.selectSpecialty = document.getElementById('select-specialty');
    dom.selectCollegeType = document.getElementById('select-college-type');
    dom.selectRound = document.getElementById('select-round');
    dom.btnPredict = document.getElementById('btn-predict');
    dom.btnReset = document.getElementById('btn-reset');
    dom.errRank = document.getElementById('err-rank');
    dom.errCategory = document.getElementById('err-category');

    // States
    dom.loadingState = document.getElementById('loading-state');
    dom.errorState = document.getElementById('error-state');
    dom.resultsSection = document.getElementById('results-section');

    // Results
    dom.resultsList = document.getElementById('results-list');
    dom.resultsCount = document.getElementById('results-count');
    dom.noResultsState = document.getElementById('no-results-state');
    dom.btnNoResultsReset = document.getElementById('btn-no-results-reset');

    // Toolbar
    dom.inputSearch = document.getElementById('input-search');
    dom.selectSort = document.getElementById('select-sort');

    // Pagination
    dom.pagination = document.getElementById('pagination');
    dom.paginationInfo = document.getElementById('pagination-info');
    dom.btnPrev = document.getElementById('btn-prev');
    dom.btnNext = document.getElementById('btn-next');
  }

  // ---- Data Loading ----
  function fetchCutoffs(counselling) {
    dom.loadingState.classList.add('is-visible');
    dom.btnPredict.disabled = true;
    var filename = 'data/cutoffs/' + encodeURIComponent(counselling) + '.json?v=' + Date.now();
    return fetch(filename).then(function (r) { 
      if (!r.ok) throw new Error(filename); 
      return r.json(); 
    }).then(function (data) {
      cutoffsData = data;
      // Generate specialties from cutoffs
      var specSet = new Set();
      cutoffsData.forEach(function (c) { if (c.specialty) specSet.add(c.specialty); });
      filtersData.specialties = Array.from(specSet).sort();
      dom.loadingState.classList.remove('is-visible');
      dom.btnPredict.disabled = false;
    });
  }

  // ---- Data Loading ----
  function loadData() {
    dom.loadingState.classList.add('is-visible');
    dom.btnPredict.disabled = true;

    var v = '?v=' + Date.now();
    Promise.all([
      fetch('data/filters.json' + v).then(function (r) { if (!r.ok) throw new Error('filters.json'); return r.json(); }),
      fetch('data/colleges.json' + v).then(function (r) { if (!r.ok) throw new Error('colleges.json'); return r.json(); })
    ]).then(function (results) {
      filtersData = results[0];
      
      // Build colleges map
      collegesMap = new Map();
      results[1].forEach(function (c) { collegesMap.set(c.id, c); });

      // Build quota label map
      if (Array.isArray(filtersData.quotas)) {
        filtersData.quotas.forEach(function (q) {
          if (typeof q === 'object' && q.code) QUOTA_LABELS[q.code] = q.label || q.code;
        });
      }

      populateFormDropdowns();
      setSelectValue(dom.selectCategory, [], true);
      setSelectValue(dom.selectCounselling, 'All India', true); // default
      restoreFromUrl();
      
      var initialCounselling = dom.selectCounselling.value || 'All India';
      
      return fetchCutoffs(initialCounselling);
    }).then(function() {
      // Dev validation (optional, can run after cutoffs loaded)
      validateDataIntegrity();

      toggleStateFilter();
      updateStateDropdown();
      updateCategoryDropdown();
      updateQuotaDropdown();
      updateCourseDropdown();
      updateSpecialtyDropdown();
      updateCollegeTypeDropdown();
      updateRoundDropdown();
      
      // Auto-run prediction on initial load
      runPrediction();
    }).catch(function (err) {
      console.error('Data loading failed:', err);
      dom.loadingState.classList.remove('is-visible');
      dom.errorState.style.display = 'block';
    });
  }

  // ---- Dev-only Validation ----
  function validateDataIntegrity() {
    var errors = [];
    var sample = cutoffsData.slice(0, Math.min(cutoffsData.length, 1000));
    sample.forEach(function (c, i) {
      if (!c.authority) errors.push('Missing authority at ' + i);
      if (!collegesMap.has(c.collegeId)) errors.push('missing collegeId: ' + c.collegeId);
      var count = c.allotments_count != null ? c.allotments_count : c.numberOfAllotments;
      if (count == null || typeof count !== 'number' || count < 0) errors.push('invalid allotments_count at ' + i);
    });
    if (errors.length > 0) {
      console.warn('[VALIDATION] Data integrity issues:', errors);
    } else {
      console.log('[VALIDATION] Data integrity OK (sampled ' + sample.length + ' records)');
    }
  }

  // ---- Populate Dropdowns ----
  function populateSelect(selectEl, items) {
    var id = selectEl.id;
    var currentVal = tomSelectInstances[id] ? tomSelectInstances[id].getValue() : (selectEl.multiple ? Array.prototype.slice.call(selectEl.selectedOptions).map(function(o){return o.value;}) : selectEl.value);

    if (tomSelectInstances[id]) {
      tomSelectInstances[id].destroy();
      tomSelectInstances[id] = null;
    }

    var firstOpt = selectEl.options[0]; // Keep "All ..." default
    selectEl.innerHTML = '';
    if (firstOpt && !selectEl.multiple) {
      selectEl.appendChild(firstOpt);
    }

    if (selectEl.multiple) {
      var allOpt = document.createElement('option');
      allOpt.value = 'ALL';
      allOpt.textContent = 'All';
      selectEl.appendChild(allOpt);
    }

    var hasGroups = items.some(function(item) {
      return typeof item === 'object' && item && item.optgroup;
    });

    if (hasGroups) {
      var groupsMap = {};
      var groupOrder = [];
      var ungrouped = [];

      items.forEach(function (item) {
        if (typeof item === 'object' && item && item.optgroup) {
          if (!groupsMap[item.optgroup]) {
            groupsMap[item.optgroup] = [];
            groupOrder.push(item.optgroup);
          }
          groupsMap[item.optgroup].push(item);
        } else {
          ungrouped.push(item);
        }
      });

      groupOrder.forEach(function (gName) {
        var optgroup = document.createElement('optgroup');
        optgroup.label = gName;
        groupsMap[gName].forEach(function (item) {
          var opt = document.createElement('option');
          opt.value = item.code || item.value;
          opt.textContent = item.label || item.code;
          optgroup.appendChild(opt);
        });
        selectEl.appendChild(optgroup);
      });

      ungrouped.forEach(function (item) {
        var opt = document.createElement('option');
        if (typeof item === 'object') {
          opt.value = item.code || item.value;
          opt.textContent = item.label || item.code;
        } else {
          opt.value = item;
          opt.textContent = item;
        }
        selectEl.appendChild(opt);
      });
    } else {
      items.forEach(function (item) {
        var opt = document.createElement('option');
        if (typeof item === 'object') {
          opt.value = item.code || item.value;
          opt.textContent = item.label || item.code;
        } else {
          opt.value = item;
          opt.textContent = item;
        }
        selectEl.appendChild(opt);
      });
    }

    // Re-apply value before initializing to make TomSelect pick it up
    if (selectEl.multiple) {
      var valArray = Array.isArray(currentVal) ? currentVal : [currentVal];
      Array.prototype.slice.call(selectEl.options).forEach(function(opt) {
        if (valArray.indexOf(opt.value) !== -1 && opt.value !== '') {
          opt.selected = true;
        }
      });
    } else {
      var exists = Array.prototype.slice.call(selectEl.options).some(function(opt) {
        return opt.value === currentVal;
      });
      if (exists && currentVal) {
        selectEl.value = currentVal;
      } else {
        selectEl.selectedIndex = 0;
      }
    }

    // Initialize Tom Select
    var tsOptions = {
      create: false,
      maxOptions: null,
      sortField: {
        field: "text",
        direction: "asc"
      }
    };
    if (selectEl.multiple) {
      tsOptions.plugins = ['remove_button'];
    }
    tomSelectInstances[id] = new TomSelect(selectEl, tsOptions);
  }

  function populateFormDropdowns() {
    // Categories
    populateSelect(dom.selectCategory, USER_CATEGORIES);
    // Counselling
    populateSelect(dom.selectCounselling, filtersData.counsellings);
    // States
    populateSelect(dom.selectState, filtersData.states);
    // Quotas
    populateSelect(dom.selectQuota, filtersData.quotas);
    // Courses
    populateSelect(dom.selectCourse, filtersData.courses);
    // Branch Types
    if (dom.selectBranchType) populateSelect(dom.selectBranchType, ['Clinical', 'Non-Clinical']);
    // Specialties
    populateSelect(dom.selectSpecialty, filtersData.specialties || []);
    // College types
    populateSelect(dom.selectCollegeType, filtersData.collegeTypes);
    // Rounds
    if (filtersData.rounds) populateSelect(dom.selectRound, filtersData.rounds);
  }

  // ---- Prediction ----
  function calculatePrediction(userRank, closingRank) {
    var ratio = userRank / closingRank;
    var rankGap = closingRank - userRank;
    var band;
    if (ratio <= 0.85) band = 'strong';
    else if (ratio <= 1.00) band = 'possible';
    else if (ratio <= 1.10) band = 'reach';
    else band = 'outside';
    return { band: band, ratio: ratio, rankGap: rankGap };
  }

  function getEligibleSeatCategories(categories) {
    var eligible = [];
    var catArray = Array.isArray(categories) ? categories : [categories];
    catArray.forEach(function(cat) {
      if (!cat || cat === 'ALL') return;
      var catEligible = (CATEGORY_ELIGIBILITY[cat] || [cat]).slice();

      // All qualifying candidate categories can compete for Open Competition and Management Seats
      if (cat === 'GN' || cat === 'EW' || cat === 'BC' || cat === 'BCA' || cat === 'BCB' || cat === 'MBC' || cat === 'SC' || cat === 'SCD' || cat === 'ST' || cat === 'ST-STA' || cat.indexOf('PwD') !== -1) {
        catEligible = catEligible.concat(OPEN_COMPETITION_CATEGORIES);
        catEligible = catEligible.concat(MANAGEMENT_CATEGORIES);
        // Madhya Pradesh Unreserved & Open NRI
        catEligible = catEligible.concat(['UR/X/OP', 'UR (Non Domicile)', 'UR/NRI/OP', 'UR/NRI (Non Domicile)']);
        // Haryana Open / Management / NRI / Minority
        catEligible = catEligible.concat(['MNG', 'NRI', 'MINORITY']);
      }

      // Social & Gender Reservations
      if (cat === 'BC' || cat === 'BC PwD') {
        catEligible = catEligible.concat(SOCIAL_GENDER_CATEGORIES['OBC']);
        catEligible = catEligible.concat(['OBC/X/OP', 'BCA', 'BCB', 'MBC']);
      }
      if (cat === 'BCA') {
        catEligible = catEligible.concat(['BCA', 'BCA ESM', 'BCA ESM FF', 'UR', 'GEN', 'MNG']);
      }
      if (cat === 'BCB') {
        catEligible = catEligible.concat(['BCB', 'BCB-PH', 'UR', 'GEN', 'MNG']);
      }
      if (cat === 'MBC') {
        catEligible = catEligible.concat(['MBC', 'OBC', 'GEN', 'UR']);
      }
      if (cat === 'SC' || cat === 'SC PwD') {
        catEligible = catEligible.concat(SOCIAL_GENDER_CATEGORIES['SC']);
        catEligible = catEligible.concat(['SC/X/OP', 'SCD', 'SC ESM']);
      }
      if (cat === 'SCD') {
        catEligible = catEligible.concat(['SCD', 'SC', 'SC ESM', 'UR', 'GEN']);
      }
      if (cat === 'ST' || cat === 'ST PwD') {
        catEligible = catEligible.concat(SOCIAL_GENDER_CATEGORIES['ST']);
        catEligible = catEligible.concat(['ST/X/OP', 'ST-STA']);
      }
      if (cat === 'ST-STA') {
        catEligible = catEligible.concat(['ST-STA', 'ST', 'GEN', 'UR']);
      }
      if (cat === 'EW' || cat === 'EW PwD') {
        catEligible = catEligible.concat(['EWS', 'EW', 'EWS/X/OP']);
      }

      // In-Service Categories (MP, Haryana, Rajasthan)
      if (cat === 'UR-Service') {
        catEligible = catEligible.concat(['UR/X/OP Service', 'UR Service', 'UR ESM FF', 'UR FF', 'UR ESM', 'UR/X/OP', 'UR (Non Domicile)', 'UR', 'GEN']);
      }
      if (cat === 'OBC-Service' || cat === 'BC-Service') {
        catEligible = catEligible.concat(['OBC/X/OP Service', 'BCA Service', 'BCB Service', 'UR Service', 'OBC/X/OP', 'BCA', 'BCB', 'OBC', 'UR/X/OP', 'UR (Non Domicile)', 'UR', 'GEN']);
      }
      if (cat === 'BCA-Service') {
        catEligible = catEligible.concat(['BCA Service', 'UR Service', 'BCA', 'UR', 'GEN', 'MNG']);
      }
      if (cat === 'BCB-Service') {
        catEligible = catEligible.concat(['BCB Service', 'UR Service', 'BCB', 'UR', 'GEN', 'MNG']);
      }
      if (cat === 'SC-Service') {
        catEligible = catEligible.concat(['SC/X/OP Service', 'SC Service', 'SCD Service', 'UR Service', 'SC/X/OP', 'SC', 'SCD', 'UR/X/OP', 'UR (Non Domicile)', 'UR', 'GEN']);
      }
      if (cat === 'SCD-Service') {
        catEligible = catEligible.concat(['SCD Service', 'SC Service', 'UR Service', 'SCD', 'SC', 'UR', 'GEN']);
      }
      if (cat === 'ST-Service') {
        catEligible = catEligible.concat(['ST/X/OP Service', 'ST/X/OP', 'ST', 'UR/X/OP', 'UR (Non Domicile)', 'UR', 'GEN']);
      }
      if (cat === 'EWS-Service') {
        catEligible = catEligible.concat(['EWS/X/OP Service', 'UR Service', 'EWS/X/OP', 'EWS', 'UR/X/OP', 'UR (Non Domicile)', 'UR', 'GEN']);
      }

      // Institutional Preference (Haryana IP)
      if (cat === 'IP') {
        catEligible = catEligible.concat([
          'IP-UR', 'IP-BCA', 'IP-BCB', 'IP-SC', 'IP-SCD',
          'IP-UR Service', 'IP-BCA Service', 'IP-BCB Service', 'IP-SC Service', 'IP-SCD Service',
          'IP-UR-PH Service', 'IP-UR Service ESM FF', 'UR', 'GEN'
        ]);
      }

      // PwD Horizontal Reservations
      if (cat === 'GN PwD') catEligible = catEligible.concat(['GEN-PwD', 'UR/PH/OP', 'UR/PH/OP Service', 'UR-PH', 'UR-PH Service']);
      if (cat === 'EW PwD') catEligible = catEligible.concat(['EWS-PwD', 'GEN-PwD', 'EWS/PH/OP', 'UR/PH/OP', 'UR-PH']);
      if (cat === 'BC PwD') catEligible = catEligible.concat(['OBC-PwD', 'GEN-PwD', 'OBC/PH/OP', 'UR/PH/OP', 'UR-PH', 'BCB-PH', 'BCB-PH Service']);
      if (cat === 'SC PwD') catEligible = catEligible.concat(['SC-PwD', 'GEN-PwD', 'SC/PH/OP', 'UR/PH/OP', 'UR-PH']);
      if (cat === 'ST PwD') catEligible = catEligible.concat(['ST-PwD', 'GEN-PwD', 'ST/PH/OP', 'UR/PH/OP', 'UR-PH']);
      
      catEligible.forEach(function(ec) {
        if (eligible.indexOf(ec) === -1) eligible.push(ec);
      });
    });
    return eligible;
  }

  function getRoundNumber(roundStr) {
    if (!roundStr) return 99;
    var m = roundStr.match(/(?:round|rd)\s*(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : 99;
  }

  function matchCollegeType(filterType, collegeType, rowQuota, rowCounselling) {
    if (!filterType || filterType === 'ALL') return true;
    if (filterType === collegeType) return true;

    // Madhya Pradesh Institution & Domicile Types
    if (rowCounselling === 'Madhya Pradesh' || MP_QUOTA_GROUPS[filterType]) {
      if (MP_QUOTA_GROUPS[filterType] && rowQuota && MP_QUOTA_GROUPS[filterType].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // Haryana Institution & Quota Types
    if (rowCounselling === 'Haryana' || HARYANA_QUOTA_GROUPS[filterType]) {
      if (HARYANA_QUOTA_GROUPS[filterType] && rowQuota && HARYANA_QUOTA_GROUPS[filterType].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // Rajasthan Institution & Quota Types
    if (rowCounselling === 'Rajasthan' || RAJASTHAN_QUOTA_GROUPS[filterType]) {
      if (RAJASTHAN_QUOTA_GROUPS[filterType] && rowQuota && RAJASTHAN_QUOTA_GROUPS[filterType].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // Open States Quota / Institution Types
    if (rowCounselling === 'Open States' || OPEN_STATES_QUOTA_GROUPS[filterType]) {
      if (OPEN_STATES_QUOTA_GROUPS[filterType] && rowQuota && OPEN_STATES_QUOTA_GROUPS[filterType].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // DNB / NBE (Govt & Private) aliases
    var dnbTypes = ['DNB / NBE (Govt & Private)', 'DNB Hospital', 'DNB'];
    if (dnbTypes.indexOf(filterType) !== -1 && dnbTypes.indexOf(collegeType) !== -1) return true;

    var govtTypes = ['Government / All India', 'Government'];
    if (govtTypes.indexOf(filterType) !== -1 && govtTypes.indexOf(collegeType) !== -1) return true;

    var centralTypes = ['Central Universities (Govt)', 'Central University'];
    if (centralTypes.indexOf(filterType) !== -1 && centralTypes.indexOf(collegeType) !== -1) return true;

    var deemedTypes = ['Deemed Universities (Private)', 'Deemed University', 'Deemed'];
    if (deemedTypes.indexOf(filterType) !== -1 && deemedTypes.indexOf(collegeType) !== -1) return true;

    var armedTypes = ['Armed Forces (Defense)', 'Armed Forces', 'AFMS'];
    if (armedTypes.indexOf(filterType) !== -1 && armedTypes.indexOf(collegeType) !== -1) return true;

    return false;
  }

  function matchQuota(filterQuota, rowQuota, rowCounselling) {
    if (!filterQuota || filterQuota === 'ALL') return true;
    if (filterQuota === rowQuota) return true;

    // DNB / NBE (Govt & Private) matches both DNB Post MBBS and NBE Diploma
    if (filterQuota === 'DNB / NBE (Govt & Private)' && (rowQuota === 'DNB Post MBBS' || rowQuota === 'NBE Diploma')) {
      return true;
    }

    // Madhya Pradesh Quota Groups
    if (rowCounselling === 'Madhya Pradesh' || MP_QUOTA_GROUPS[filterQuota]) {
      if (MP_QUOTA_GROUPS[filterQuota] && MP_QUOTA_GROUPS[filterQuota].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // Haryana Quota Groups
    if (rowCounselling === 'Haryana' || HARYANA_QUOTA_GROUPS[filterQuota]) {
      if (HARYANA_QUOTA_GROUPS[filterQuota] && HARYANA_QUOTA_GROUPS[filterQuota].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // Rajasthan Quota Groups
    if (rowCounselling === 'Rajasthan' || RAJASTHAN_QUOTA_GROUPS[filterQuota]) {
      if (RAJASTHAN_QUOTA_GROUPS[filterQuota] && RAJASTHAN_QUOTA_GROUPS[filterQuota].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    // Open States Quota Groups
    if (rowCounselling === 'Open States' || OPEN_STATES_QUOTA_GROUPS[filterQuota]) {
      if (OPEN_STATES_QUOTA_GROUPS[filterQuota] && OPEN_STATES_QUOTA_GROUPS[filterQuota].indexOf(rowQuota) !== -1) {
        return true;
      }
    }

    return false;
  }

  // ---- Filtering ----
  function applyFilters(userRank, userCategory, filters) {
    var eligible = getEligibleSeatCategories(userCategory);
    var catArray = Array.isArray(userCategory) ? userCategory : [userCategory];

    return cutoffsData.filter(function (row) {
      if (catArray.indexOf('ALL') === -1 && eligible.indexOf(row.seatCategory) === -1) return false;
      if (row.closingRank < userRank) return false;

      // Form/sidebar filters
      if (filters.quota && filters.quota.length > 0) {
        var quotaArray = Array.isArray(filters.quota) ? filters.quota : [filters.quota];
        if (quotaArray.indexOf('ALL') === -1) {
          var quotaMatched = quotaArray.some(function(selQuota) {
            return matchQuota(selQuota, row.quotaCode, row.counselling);
          });
          if (!quotaMatched) return false;
        }
      }
      if (filters.course && filters.course.length > 0) {
        var courseArray = Array.isArray(filters.course) ? filters.course : [filters.course];
        if (courseArray.indexOf('ALL') === -1 && courseArray.indexOf(row.course) === -1) return false;
      }
      if (filters.branchType && filters.branchType.length > 0) {
        var btArray = Array.isArray(filters.branchType) ? filters.branchType : [filters.branchType];
        var bType = getBranchType(row.specialty);
        if (btArray.indexOf('ALL') === -1 && btArray.indexOf(bType) === -1) return false;
      }
      if (filters.specialties && filters.specialties.length > 0) {
        var specArray = Array.isArray(filters.specialties) ? filters.specialties : [filters.specialties];
        if (specArray.indexOf('ALL') === -1 && specArray.indexOf(row.specialty) === -1) return false;
      }
      if (filters.round) {
        if (getRoundNumber(row.round) < getRoundNumber(filters.round)) return false;
      }
      if (filters.counselling) {
        var rowCounselling = row.counselling || 'All India';
        if (rowCounselling !== filters.counselling) return false;
      }

      // College-level filters
      if (!collegesMap.has(row.collegeId)) return false;
      var college = collegesMap.get(row.collegeId);
      if (filters.collegeType && filters.collegeType.length > 0) {
        var ctArray = Array.isArray(filters.collegeType) ? filters.collegeType : [filters.collegeType];
        if (ctArray.indexOf('ALL') === -1) {
          var ctMatched = ctArray.some(function(selType) {
            return matchCollegeType(selType, college.collegeType, row.quotaCode, row.counselling);
          });
          if (!ctMatched) return false;
        }
      }
      if (filters.state && college.state !== filters.state) return false;

      return true;
    });
  }

  function applySearch(results, term) {
    if (!term) return results;
    var lower = term.toLowerCase();
    return results.filter(function (item) {
      var college = item.college;
      return (
        college.name.toLowerCase().indexOf(lower) !== -1 ||
        (college.city && college.city.toLowerCase().indexOf(lower) !== -1) ||
        (college.state && college.state.toLowerCase().indexOf(lower) !== -1) ||
        item.cutoff.specialty.toLowerCase().indexOf(lower) !== -1
      );
    });
  }

  // ---- Sorting ----
  function parseCurrency(str) {
    if (!str) return 0;
    var numStr = str.replace(/[^\d.-]/g, '');
    return parseFloat(numStr) || 0;
  }

  function sortResults(results, sortBy) {
    results.sort(function (a, b) {
      switch (sortBy) {
        case 'prediction':
          var bandDiff = BAND_ORDER[a.prediction.band] - BAND_ORDER[b.prediction.band];
          if (bandDiff !== 0) return bandDiff;
          return b.prediction.rankGap - a.prediction.rankGap;
        case 'college':
          return a.college.name.localeCompare(b.college.name);
        case 'state':
          var sCmp = (a.college.state || '').localeCompare(b.college.state || '');
          if (sCmp !== 0) return sCmp;
          return a.college.name.localeCompare(b.college.name);
        case 'course':
          var cCmp = a.cutoff.course.localeCompare(b.cutoff.course);
          if (cCmp !== 0) return cCmp;
          return a.cutoff.specialty.localeCompare(b.cutoff.specialty);
        case 'specialty':
          return a.cutoff.specialty.localeCompare(b.cutoff.specialty);
        case 'rank-asc':
          return a.cutoff.closingRank - b.cutoff.closingRank;
        case 'rank-desc':
          return b.cutoff.closingRank - a.cutoff.closingRank;
        case 'fee-asc':
          return parseCurrency(a.cutoff.fee) - parseCurrency(b.cutoff.fee);
        case 'fee-desc':
          return parseCurrency(b.cutoff.fee) - parseCurrency(a.cutoff.fee);
        case 'stipend-asc':
          return parseCurrency(a.cutoff.stipend) - parseCurrency(b.cutoff.stipend);
        case 'stipend-desc':
          return parseCurrency(b.cutoff.stipend) - parseCurrency(a.cutoff.stipend);
        default:
          return 0;
      }
    });
    return results;
  }

  // ---- Rendering ----
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatNumber(n) {
    if (n == null) return '—';
    return n.toLocaleString('en-IN');
  }

  function renderResultsPage() {
    dom.resultsList.innerHTML = '';
    dom.noResultsState.style.display = 'none';
    dom.pagination.style.display = 'none';

    if (currentResults.length === 0) {
      dom.noResultsState.style.display = 'block';
      return;
    }

    totalPages = Math.ceil(currentResults.length / PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    var start = (currentPage - 1) * PAGE_SIZE;
    var end = Math.min(start + PAGE_SIZE, currentResults.length);
    var pageItems = currentResults.slice(start, end);

    var fragment = document.createDocumentFragment();
    pageItems.forEach(function (item) {
      fragment.appendChild(buildResultCard(item));
    });
    dom.resultsList.appendChild(fragment);

    // Pagination
    if (totalPages > 1) {
      dom.pagination.style.display = 'flex';
      dom.paginationInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
      dom.btnPrev.disabled = currentPage <= 1;
      dom.btnNext.disabled = currentPage >= totalPages;
    }
  }

  function buildResultCard(item) {
    var card = document.createElement('div');
    card.className = 'result-card';
    card.setAttribute('role', 'listitem');

    var quotaLabel = QUOTA_LABELS[item.cutoff.quotaCode] || item.cutoff.quotaCode;
    var stateLabel = item.college.state ? escapeHtml(item.college.state) : '';

    var courseStr = escapeHtml(item.cutoff.course);
    if (item.cutoff.specialty) {
        courseStr += ' ' + escapeHtml(item.cutoff.specialty);
    }

    var roundsHtml = item.rounds.map(function(r) {
      var badgeClass = 'badge-' + r.prediction.band;
      var cleanRound = escapeHtml(r.round).replace(/^24\s+/i, '');
      cleanRound = cleanRound.split(' ').map(function(w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      var roundLabel = cleanRound;
      if (r.year) {
        roundLabel += ' ' + r.year;
      }
      var count = r.allotments_count != null ? r.allotments_count : r.numberOfAllotments;
      var countBadge = '';
      if (count != null && count > 0) {
        countBadge = ' <span class="badge-allotments" title="' + count + ' ' + (count === 1 ? 'allotment' : 'allotments') + '">(' + count + ' ' + (count === 1 ? 'seat' : 'seats') + ')</span>';
      }
      return '<span class="round-badge ' + badgeClass + '">' + roundLabel + ': <strong>' + r.closingRank.toLocaleString('en-IN') + '</strong>' + countBadge + '</span>';
    }).join(' ');

    var feeHtml = '';
    if (item.cutoff.fee) {
      feeHtml = '<span class="round-badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;">Fee: <strong>' + escapeHtml(item.cutoff.fee) + '</strong></span>';
    }
    var stipendHtml = '';
    if (item.cutoff.stipend) {
      stipendHtml = '<span class="round-badge" style="background: #fdf4ff; color: #86198f; border: 1px solid #f5d0fe;">Stipend: <strong>' + escapeHtml(item.cutoff.stipend) + '</strong></span>';
    }

    function getFriendlyCollegeType(cType, quotaCode, counselling) {
      if (counselling === 'Madhya Pradesh') {
        if (MP_QUOTA_GROUPS['Government (State Domicile)'].indexOf(quotaCode) !== -1) return 'Government (State Domicile)';
        if (MP_QUOTA_GROUPS['Private (State Domicile)'].indexOf(quotaCode) !== -1) return 'Private (State Domicile)';
        if (MP_QUOTA_GROUPS['Non-Domicile / Open (All India)'].indexOf(quotaCode) !== -1) return 'Non-Domicile / Open (All India)';
        if (MP_QUOTA_GROUPS['NRI Quota'].indexOf(quotaCode) !== -1) return 'NRI Quota';
      } else if (counselling === 'Haryana') {
        for (var hGrp in HARYANA_QUOTA_GROUPS) {
          if (HARYANA_QUOTA_GROUPS[hGrp].indexOf(quotaCode) !== -1) return hGrp;
        }
      } else if (counselling === 'Rajasthan') {
        for (var rGrp in RAJASTHAN_QUOTA_GROUPS) {
          if (RAJASTHAN_QUOTA_GROUPS[rGrp].indexOf(quotaCode) !== -1) return rGrp;
        }
      } else if (counselling === 'Open States') {
        if (OPEN_STATES_QUOTA_GROUPS['Private Open Seats (Merit)'].indexOf(quotaCode) !== -1) return 'Private Open Seats (Merit)';
        if (OPEN_STATES_QUOTA_GROUPS['Management / Institutional Seats'].indexOf(quotaCode) !== -1) return 'Management / Institutional Seats';
        if (OPEN_STATES_QUOTA_GROUPS['Government / State General Seats'].indexOf(quotaCode) !== -1) return 'Government / State General Seats';
      } else {
        if (quotaCode) {
          for (var hGrp2 in HARYANA_QUOTA_GROUPS) {
            if (HARYANA_QUOTA_GROUPS[hGrp2].indexOf(quotaCode) !== -1) return hGrp2;
          }
          for (var rGrp2 in RAJASTHAN_QUOTA_GROUPS) {
            if (RAJASTHAN_QUOTA_GROUPS[rGrp2].indexOf(quotaCode) !== -1) return rGrp2;
          }
          if (MP_QUOTA_GROUPS['Government (State Domicile)'].indexOf(quotaCode) !== -1) return 'Government (State Domicile)';
          if (MP_QUOTA_GROUPS['Private (State Domicile)'].indexOf(quotaCode) !== -1) return 'Private (State Domicile)';
          if (MP_QUOTA_GROUPS['Non-Domicile / Open (All India)'].indexOf(quotaCode) !== -1) return 'Non-Domicile / Open (All India)';
          if (MP_QUOTA_GROUPS['NRI Quota'].indexOf(quotaCode) !== -1) return 'NRI Quota';
          if (OPEN_STATES_QUOTA_GROUPS['Private Open Seats (Merit)'].indexOf(quotaCode) !== -1) return 'Private Open Seats (Merit)';
          if (OPEN_STATES_QUOTA_GROUPS['Management / Institutional Seats'].indexOf(quotaCode) !== -1) return 'Management / Institutional Seats';
          if (OPEN_STATES_QUOTA_GROUPS['Government / State General Seats'].indexOf(quotaCode) !== -1) return 'Government / State General Seats';
        }
      }
      if (!cType) return '';
      if (cType === 'DNB Hospital' || cType === 'DNB') return 'DNB / NBE (Govt & Private)';
      if (cType === 'Government') return 'Government / All India';
      if (cType === 'Central University') return 'Central Universities (Govt)';
      if (cType === 'Deemed University') return 'Deemed Universities (Private)';
      if (cType === 'Armed Forces') return 'Armed Forces (Defense)';
      return cType;
    }

    card.innerHTML =
      '<div class="result-card-top">' +
        '<h3 class="result-college-name">' + escapeHtml(item.college.name) + '</h3>' +
      '</div>' +
      '<div class="result-course-name">' + courseStr + '</div>' +
      '<div class="result-meta-row">' +
        '<div class="meta-group"><span class="meta-label">Seat Category:</span> <span class="meta-value">' + escapeHtml(item.cutoff.seatCategory) + '</span></div>' +
        '<div class="meta-group"><span class="meta-label">Quota:</span> <span class="meta-value">' + escapeHtml(quotaLabel) + '</span></div>' +
        (item.college.collegeType ? '<div class="meta-group"><span class="meta-label">Type:</span> <span class="meta-value">' + escapeHtml(getFriendlyCollegeType(item.college.collegeType, item.cutoff.quotaCode, item.cutoff.counselling)) + '</span></div>' : '') +
        (stateLabel ? '<div class="meta-group"><span class="meta-label">State:</span> <span class="meta-value">' + stateLabel + '</span></div>' : '') +
      '</div>' +
      '<div class="result-rounds-container" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px;">' +
        roundsHtml +
        feeHtml +
        stipendHtml +
      '</div>';

    return card;
  }



  // ---- Core Prediction Flow ----
  function runPrediction() {
    // Validate
    var rank = parseInt(dom.inputRank.value, 10);
    var category = tomSelectInstances['select-category'] ? tomSelectInstances['select-category'].getValue() : dom.selectCategory.value;
    var valid = true;

    clearErrors();

    if (!rank || rank < 1 || isNaN(rank)) {
      showError('fg-rank', 'err-rank', 'Enter a valid positive rank.');
      dom.inputRank.focus();
      dom.inputRank.scrollIntoView({ behavior: 'smooth', block: 'center' });
      valid = false;
    }
    if (!category || (Array.isArray(category) && category.length === 0)) {
      category = ['ALL'];
    }
    if (!valid) return;

    currentUserRank = rank;
    currentCategory = category;
    currentPage = 1;

    // Gather filters from form
    var filters = {
      counselling: dom.selectCounselling.value,
      state: dom.selectState.value,
      quota: tomSelectInstances['select-quota'] ? tomSelectInstances['select-quota'].getValue() : [],
      course: tomSelectInstances['select-course'] ? tomSelectInstances['select-course'].getValue() : [],
      branchType: tomSelectInstances['select-branch-type'] ? tomSelectInstances['select-branch-type'].getValue() : [],
      specialties: tomSelectInstances['select-specialty'] ? tomSelectInstances['select-specialty'].getValue() : [],
      collegeType: tomSelectInstances['select-college-type'] ? tomSelectInstances['select-college-type'].getValue() : [],
      round: dom.selectRound ? dom.selectRound.value : "",
    };

    // Filter
    var filtered = applyFilters(rank, category, filters);

    // Enrich with college data, predictions, and group by unique seat
    var enrichedMap = {};

    filtered.forEach(function (row) {
      var college = collegesMap.get(row.collegeId);
      if (!college) return;
      
      var uniqueKey = row.collegeId + '|' + row.course + '|' + row.specialty + '|' + row.quotaCode;
      var allotmentsCount = row.allotments_count != null ? row.allotments_count : (row.numberOfAllotments != null ? row.numberOfAllotments : 0);
      var roundItem = {
        round: row.round,
        year: row.year,
        closingRank: row.closingRank,
        allotments_count: allotmentsCount,
        numberOfAllotments: allotmentsCount,
        prediction: calculatePrediction(rank, row.closingRank)
      };

      if (!enrichedMap[uniqueKey]) {
        enrichedMap[uniqueKey] = {
          cutoff: row,
          college: college,
          prediction: calculatePrediction(rank, row.closingRank),
          rounds: [roundItem]
        };
      } else {
        enrichedMap[uniqueKey].rounds.push(roundItem);
        // Keep the best cutoff (highest closing rank) as the main reference for sorting
        if (row.closingRank > enrichedMap[uniqueKey].cutoff.closingRank) {
          enrichedMap[uniqueKey].cutoff = row;
          enrichedMap[uniqueKey].prediction = calculatePrediction(rank, row.closingRank);
        }
      }
    });

    var enriched = [];
    for (var key in enrichedMap) {
      if (enrichedMap.hasOwnProperty(key)) {
        var item = enrichedMap[key];
        // Sort rounds within the card
        item.rounds.sort(function(a, b) {
           var yA = a.year || 0;
           var yB = b.year || 0;
           if (yA !== yB) return yB - yA; // descending year

           var rA = getRoundNumber(a.round);
           var rB = getRoundNumber(b.round);
           if (rA !== rB) return rA - rB;
           return a.round.localeCompare(b.round);
        });
        enriched.push(item);
      }
    }

    // Sort
    currentResults = sortResults(enriched, dom.selectSort.value);

    // Apply search if term exists
    if (searchTerm) {
      currentResults = applySearch(currentResults, searchTerm);
    }

    // Show results
    renderResultsPage();
    updateUrl();
  }

  function autoPredict() {
    if (currentUserRank && currentCategory) {
      runPrediction();
    }
  }

  // ---- Error Handling ----
  function showError(groupId, errId, msg) {
    var group = document.getElementById(groupId);
    var err = document.getElementById(errId);
    if (group) group.classList.add('has-error');
    if (err) err.textContent = msg;
  }

  function clearErrors() {
    document.querySelectorAll('.form-group.has-error').forEach(function (el) {
      el.classList.remove('has-error');
    });
    document.querySelectorAll('.form-error').forEach(function (el) {
      el.textContent = '';
    });
  }

  // ---- UI Helpers ----
  function toggleStateFilter() {
    var counselling = dom.selectCounselling.value;
    var stateGroup = document.getElementById('state-filter-group');
    if (!stateGroup) return;

    if (counselling === '' || counselling === 'Open States' || counselling === 'All India') {
      stateGroup.style.display = 'block';
    } else {
      stateGroup.style.display = 'none';
      dom.selectState.value = '';
    }
  }

  function updateStateDropdown() {
    var counselling = dom.selectCounselling.value;
    var currentState = dom.selectState.value;

    if (!(counselling === '' || counselling === 'Open States' || counselling === 'All India')) {
      return;
    }

    var validStates = new Set();
    if (cutoffsData && collegesMap) {
      cutoffsData.forEach(function (row) {
        var rowCounselling = row.counselling || 'All India';
        if (counselling === '' || rowCounselling === counselling) {
          var college = collegesMap.get(row.collegeId);
          if (college && college.state) {
            validStates.add(college.state);
          }
        }
      });
    }

    var filteredStates = filtersData.states.filter(function(s) {
      return validStates.has(s);
    });

    if (filteredStates.length === 0) {
      filteredStates = filtersData.states;
    }

    populateSelect(dom.selectState, filteredStates);
  }

  function updateQuotaDropdown() {
    var counselling = dom.selectCounselling.value;
    var currentQuota = dom.selectQuota.value;

    var validQuotas = new Set();
    if (cutoffsData) {
      cutoffsData.forEach(function (row) {
        var rowCounselling = row.counselling || 'All India';
        if (counselling === '' || rowCounselling === counselling) {
          if (row.quotaCode) {
            validQuotas.add(row.quotaCode);
          }
        }
      });
    }

    if (validQuotas.has('DNB Post MBBS') || validQuotas.has('NBE Diploma')) {
      validQuotas.add('DNB / NBE (Govt & Private)');
    }

    // Open States Quota Groups: if any child quota is present, add the parent group
    Object.keys(OPEN_STATES_QUOTA_GROUPS).forEach(function(groupName) {
      var hasAny = OPEN_STATES_QUOTA_GROUPS[groupName].some(function(q) {
        return validQuotas.has(q);
      });
      if (hasAny) {
        validQuotas.add(groupName);
      }
    });

    // Madhya Pradesh Quota Groups: if any child quota is present, add the parent group
    Object.keys(MP_QUOTA_GROUPS).forEach(function(groupName) {
      var hasAny = MP_QUOTA_GROUPS[groupName].some(function(q) {
        return validQuotas.has(q);
      });
      if (hasAny) {
        validQuotas.add(groupName);
      }
    });

    var filteredQuotas = filtersData.quotas.filter(function(q) {
      return validQuotas.has(q.code);
    }).map(function(q) {
      if (counselling === 'Haryana') {
        var qObj = Object.assign({}, q);
        for (var grp in HARYANA_QUOTA_GROUPS) {
          if (q.code === grp || HARYANA_QUOTA_GROUPS[grp].indexOf(q.code) !== -1) {
            qObj.optgroup = grp;
            break;
          }
        }
        return qObj;
      } else if (counselling === 'Rajasthan') {
        var qObj = Object.assign({}, q);
        for (var grp in RAJASTHAN_QUOTA_GROUPS) {
          if (q.code === grp || RAJASTHAN_QUOTA_GROUPS[grp].indexOf(q.code) !== -1) {
            qObj.optgroup = grp;
            break;
          }
        }
        return qObj;
      } else if (counselling === 'Madhya Pradesh') {
        var qObj = Object.assign({}, q);
        for (var grp in MP_QUOTA_GROUPS) {
          if (q.code === grp || MP_QUOTA_GROUPS[grp].indexOf(q.code) !== -1) {
            qObj.optgroup = grp;
            break;
          }
        }
        return qObj;
      }
      return q;
    });

    if (filteredQuotas.length === 0) {
      filteredQuotas = filtersData.quotas;
    }

    populateSelect(dom.selectQuota, filteredQuotas);
  }

  function updateSpecialtyDropdown() {
    var courses = tomSelectInstances['select-course'] ? tomSelectInstances['select-course'].getValue() : [];
    if (typeof courses === 'string' && courses) courses = [courses];
    
    var branchTypes = tomSelectInstances['select-branch-type'] ? tomSelectInstances['select-branch-type'].getValue() : [];
    if (typeof branchTypes === 'string' && branchTypes) branchTypes = [branchTypes];

    if ((!courses || courses.length === 0) && (!branchTypes || branchTypes.length === 0)) {
      populateSelect(dom.selectSpecialty, filtersData.specialties);
    } else {
      var validSpecialties = new Set();
      if (cutoffsData) {
        cutoffsData.forEach(function (row) {
          if (!row.specialty) return;
          var courseMatch = (!courses || courses.length === 0) || courses.indexOf(row.course) !== -1;
          var btMatch = (!branchTypes || branchTypes.length === 0) || branchTypes.indexOf(getBranchType(row.specialty)) !== -1;
          
          if (courseMatch && btMatch) {
            validSpecialties.add(row.specialty);
          }
        });
      }

      var filteredSpecialties = filtersData.specialties.filter(function(s) {
        return validSpecialties.has(s);
      });

      if (filteredSpecialties.length === 0) {
        filteredSpecialties = filtersData.specialties;
      }

      populateSelect(dom.selectSpecialty, filteredSpecialties);
    }
  }

  function updateCollegeTypeDropdown() {
    var counselling = dom.selectCounselling ? dom.selectCounselling.value : '';
    var validCollegeTypes = new Set();

    if (counselling === 'Open States' || (cutoffsData && cutoffsData.length > 0 && cutoffsData[0].counselling === 'Open States')) {
      validCollegeTypes.add('Private Open Seats (Merit)');
      validCollegeTypes.add('Management / Institutional Seats');
      validCollegeTypes.add('Government / State General Seats');
    } else if (counselling === 'Haryana' || (cutoffsData && cutoffsData.length > 0 && cutoffsData[0].counselling === 'Haryana')) {
      for (var hGrp in HARYANA_QUOTA_GROUPS) validCollegeTypes.add(hGrp);
    } else if (counselling === 'Rajasthan' || (cutoffsData && cutoffsData.length > 0 && cutoffsData[0].counselling === 'Rajasthan')) {
      for (var rGrp in RAJASTHAN_QUOTA_GROUPS) validCollegeTypes.add(rGrp);
    } else if (counselling === 'Madhya Pradesh' || (cutoffsData && cutoffsData.length > 0 && cutoffsData[0].counselling === 'Madhya Pradesh')) {
      validCollegeTypes.add('Government (State Domicile)');
      validCollegeTypes.add('Private (State Domicile)');
      validCollegeTypes.add('Non-Domicile / Open (All India)');
      validCollegeTypes.add('NRI Quota');
    } else {
      if (cutoffsData && collegesMap) {
        cutoffsData.forEach(function (row) {
          var college = collegesMap.get(row.collegeId);
          if (college && college.collegeType) {
            validCollegeTypes.add(college.collegeType);
          }
        });
      }

      if (validCollegeTypes.has('DNB Hospital') || validCollegeTypes.has('DNB / NBE (Govt & Private)')) {
        validCollegeTypes.add('DNB / NBE (Govt & Private)');
        validCollegeTypes.add('DNB Hospital');
      }
      if (validCollegeTypes.has('Government')) {
        validCollegeTypes.add('Government / All India');
      }
      if (validCollegeTypes.has('Central University')) {
        validCollegeTypes.add('Central Universities (Govt)');
      }
      if (validCollegeTypes.has('Deemed University')) {
        validCollegeTypes.add('Deemed Universities (Private)');
      }
      if (validCollegeTypes.has('Armed Forces')) {
        validCollegeTypes.add('Armed Forces (Defense)');
      }
    }

    var filteredTypes = filtersData.collegeTypes.filter(function(t) {
      var tVal = typeof t === 'object' ? (t.code || t.value) : t;
      return validCollegeTypes.has(tVal);
    });

    if (filteredTypes.length === 0) {
      filteredTypes = filtersData.collegeTypes;
    }

    populateSelect(dom.selectCollegeType, filteredTypes);
  }

  function updateCategoryDropdown() {
    var validCategories = new Set();
    if (cutoffsData) {
      cutoffsData.forEach(function (row) {
        if (row.seatCategory) {
          validCategories.add(row.seatCategory);
        }
      });
    }
    var filteredCategories = USER_CATEGORIES.filter(function(cat) {
      var eligible = getEligibleSeatCategories(cat.code);
      return eligible.some(function(e) { return validCategories.has(e); });
    });
    if (filteredCategories.length === 0) {
      filteredCategories = USER_CATEGORIES;
    }
    populateSelect(dom.selectCategory, filteredCategories);
  }

  function updateCourseDropdown() {
    var validCourses = new Set();
    if (cutoffsData) {
      cutoffsData.forEach(function (row) {
        if (row.course) {
          validCourses.add(row.course);
        }
      });
    }
    var filteredCourses = filtersData.courses.filter(function(c) {
      var courseVal = typeof c === 'object' ? (c.code || c.value) : c;
      return validCourses.has(courseVal);
    });
    if (filteredCourses.length === 0) {
      filteredCourses = filtersData.courses;
    }
    populateSelect(dom.selectCourse, filteredCourses);
  }

  function updateRoundDropdown() {
    if (!dom.selectRound) return;
    var validRounds = new Set();
    if (cutoffsData) {
      cutoffsData.forEach(function (row) {
        if (row.round) {
          validRounds.add(row.round);
        }
      });
    }
    var filteredRounds = filtersData.rounds ? filtersData.rounds.filter(function(r) {
      var roundVal = typeof r === 'object' ? (r.code || r.value) : r;
      return validRounds.has(roundVal);
    }) : [];
    if (filteredRounds.length === 0 && filtersData.rounds) {
      filteredRounds = filtersData.rounds;
    }
    populateSelect(dom.selectRound, filteredRounds);
  }


  // ---- Reset ----
  function resetAll() {
    dom.form.reset();
    
    // Reset Tom Selects
    for (var id in tomSelectInstances) {
      if (tomSelectInstances.hasOwnProperty(id) && tomSelectInstances[id]) {
        if (id === 'select-category') {
           tomSelectInstances[id].setValue([], true);
        } else if (id === 'select-counselling' || id === 'select-state' || id === 'select-round') {
           tomSelectInstances[id].setValue(id === 'select-counselling' ? 'All India' : '', true);
        } else {
           tomSelectInstances[id].setValue([], true);
        }
      }
    }

    if (dom.selectSort) dom.selectSort.value = 'college';
    dom.inputSearch.value = '';
    searchTerm = '';
    clearErrors();
    toggleStateFilter();
    
    // Auto-predict with default parameters
    runPrediction();
  }

  // ---- URL Sync ----
  function getMultiValue(selectId) {
    var val = tomSelectInstances[selectId] ? tomSelectInstances[selectId].getValue() : document.getElementById(selectId).value;
    if (Array.isArray(val) && val.length > 0) return val.join(',');
    if (typeof val === 'string' && val !== '') return val;
    return null;
  }

  function updateUrl() {
    var params = new URLSearchParams();
    if (currentUserRank) params.set('rank', currentUserRank);
    
    var catVal = getMultiValue('select-category');
    if (catVal) params.set('category', catVal);

    if (dom.selectCounselling.value) params.set('counselling', dom.selectCounselling.value);
    if (dom.selectState.value) params.set('state', dom.selectState.value);

    var quotaVal = getMultiValue('select-quota');
    if (quotaVal) params.set('quota', quotaVal);

    var courseVal = getMultiValue('select-course');
    if (courseVal) params.set('course', courseVal);

    var branchTypeVal = getMultiValue('select-branch-type');
    if (branchTypeVal) params.set('branchType', branchTypeVal);

    var specVal = getMultiValue('select-specialty');
    if (specVal) params.set('specialty', specVal);

    var typeVal = getMultiValue('select-college-type');
    if (typeVal) params.set('collegeType', typeVal);

    if (dom.selectRound && dom.selectRound.value) params.set('round', dom.selectRound.value);

    var qs = params.toString();
    var newUrl = qs ? window.location.pathname + '?' + qs : window.location.pathname;
    history.replaceState(null, '', newUrl);
  }

  function restoreFromUrl() {
    var params = new URLSearchParams(window.location.search);
    if (!params.has('rank') || !params.has('category')) return;

    var rankParam = params.get('rank');
    var rankVal = parseInt(rankParam, 10);
    // Guard against invalid rank params (e.g. ?rank=INVALID)
    if (isNaN(rankVal) || rankVal < 1) return;

    dom.inputRank.value = rankVal;
    
    if (params.has('category')) {
      var cats = params.get('category').split(',');
      setSelectValue(dom.selectCategory, cats, true);
    }

    if (params.has('quota')) setSelectValue(dom.selectQuota, params.get('quota').split(','), true);
    if (params.has('course')) setSelectValue(dom.selectCourse, params.get('course').split(','), true);
    if (params.has('branchType')) setSelectValue(dom.selectBranchType, params.get('branchType').split(','), true);
    if (params.has('specialty')) setSelectValue(dom.selectSpecialty, params.get('specialty').split(','), true);
    if (params.has('collegeType')) setSelectValue(dom.selectCollegeType, params.get('collegeType').split(','), true);
    
    if (params.has('counselling')) setSelectValue(dom.selectCounselling, params.get('counselling'), true);
    if (params.has('state')) setSelectValue(dom.selectState, params.get('state'), true);
    if (params.has('round') && dom.selectRound) setSelectValue(dom.selectRound, params.get('round'), true);
  }

  // ---- Event Binding ----
  function bindEvents() {
    if (dom.themeToggle) {
      dom.themeToggle.addEventListener('click', function() {
        var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });
    }

    // Form submit
    dom.form.addEventListener('submit', function (e) {
      e.preventDefault();
      runPrediction();
    });

    // Reset
    dom.btnReset.addEventListener('click', resetAll);
    if (dom.btnNoResultsReset) {
      dom.btnNoResultsReset.addEventListener('click', resetAll);
    }

    // State change -> refilter automatically
    dom.selectState.addEventListener('change', autoPredict);

    dom.selectCounselling.addEventListener('change', function() {
      var counselling = dom.selectCounselling.value;
      if (!counselling) return; // Should not happen since we removed empty option
      
      // Reset other filters when counselling changes
      setSelectValue(dom.selectCategory, [], true);
      setSelectValue(dom.selectQuota, [], true);
      setSelectValue(dom.selectCourse, [], true);
      if (dom.selectBranchType) setSelectValue(dom.selectBranchType, [], true);
      setSelectValue(dom.selectSpecialty, [], true);
      setSelectValue(dom.selectCollegeType, [], true);
      if (dom.selectRound) setSelectValue(dom.selectRound, '', true);
      setSelectValue(dom.selectState, '', true);

      fetchCutoffs(counselling).then(function() {
        toggleStateFilter();
        updateStateDropdown();
        updateCategoryDropdown();
        updateQuotaDropdown();
        updateCourseDropdown();
        updateSpecialtyDropdown();
        updateCollegeTypeDropdown();
        updateRoundDropdown();
        autoPredict(); // Re-predict when counselling is switched completely
      }).catch(function(err) {
        console.error('Failed to load new counselling data:', err);
        alert('Could not load data for ' + counselling);
      });
    });

    // Course change -> update specialties
    dom.selectCourse.addEventListener('change', function() {
      updateSpecialtyDropdown();
      autoPredict();
    });

    if (dom.selectBranchType) {
      dom.selectBranchType.addEventListener('change', function() {
        updateSpecialtyDropdown();
        autoPredict();
      });
    }

    dom.selectSpecialty.addEventListener('change', autoPredict);
    dom.selectCategory.addEventListener('change', autoPredict);
    dom.selectCollegeType.addEventListener('change', autoPredict);
    dom.selectQuota.addEventListener('change', autoPredict);
    if (dom.selectRound) dom.selectRound.addEventListener('change', autoPredict);

    // Sort change
    dom.selectSort.addEventListener('change', function () {
      if (!currentResults.length) return;
      currentResults = sortResults(currentResults, dom.selectSort.value);
      currentPage = 1;
      renderResultsPage();
    });

    // Search
    var searchTimer;
    dom.inputSearch.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        searchTerm = dom.inputSearch.value.trim();
        autoPredict();
      }, 250);
    });

    // Pagination
    dom.btnPrev.addEventListener('click', function () {
      if (currentPage > 1) {
        currentPage--;
        renderResultsPage();
        dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
    dom.btnNext.addEventListener('click', function () {
      if (currentPage < totalPages) {
        currentPage++;
        renderResultsPage();
        dom.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });


    // Clear errors on input
    dom.inputRank.addEventListener('input', function () {
      document.getElementById('fg-rank').classList.remove('has-error');
      dom.errRank.textContent = '';
    });
    dom.selectCategory.addEventListener('change', function () {
      document.getElementById('fg-category').classList.remove('has-error');
      dom.errCategory.textContent = '';
      autoPredict();
    });
  }

  // ---- Init ----
  function init() {
    cacheDom();
    bindEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
