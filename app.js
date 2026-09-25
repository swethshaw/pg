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
  var CATEGORY_ELIGIBILITY = {
    'GN':     ['GN'],
    'EW':     ['EW', 'GN'],
    'BC':     ['BC', 'GN'],
    'SC':     ['SC', 'GN'],
    'ST':     ['ST', 'GN'],
    'GN PwD': ['GN PwD', 'GN'],
    'EW PwD': ['EW PwD', 'EW', 'GN PwD', 'GN'],
    'BC PwD': ['BC PwD', 'BC', 'GN PwD', 'GN'],
    'SC PwD': ['SC PwD', 'SC', 'GN PwD', 'GN'],
    'ST PwD': ['ST PwD', 'ST', 'GN PwD', 'GN'],
  };

  var USER_CATEGORIES = [
    { code: 'GN', label: 'General (UR)' },
    { code: 'EW', label: 'EWS' },
    { code: 'BC', label: 'OBC' },
    { code: 'SC', label: 'SC' },
    { code: 'ST', label: 'ST' },
    { code: 'GN PwD', label: 'General PwD' },
    { code: 'EW PwD', label: 'EWS PwD' },
    { code: 'BC PwD', label: 'OBC PwD' },
    { code: 'SC PwD', label: 'SC PwD' },
    { code: 'ST PwD', label: 'ST PwD' }
  ];

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

    Promise.all([
      fetch('data/filters.json').then(function (r) { if (!r.ok) throw new Error('filters.json'); return r.json(); }),
      fetch('data/colleges.json').then(function (r) { if (!r.ok) throw new Error('colleges.json'); return r.json(); })
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
      setSelectValue(dom.selectCategory, 'GN', true);
      setSelectValue(dom.selectCounselling, 'All India', true); // default
      restoreFromUrl();
      
      var initialCounselling = dom.selectCounselling.value || 'All India';
      
      return fetchCutoffs(initialCounselling);
    }).then(function() {
      // Dev validation (optional, can run after cutoffs loaded)
      validateDataIntegrity();

      toggleStateFilter();
      updateStateDropdown();
      updateQuotaDropdown();
      updateSpecialtyDropdown();
      updateCollegeTypeDropdown();
      
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
      if (c.authority !== 'MCC' && c.authority !== 'Open States') errors.push('Unknown authority at ' + i);
      if (!collegesMap.has(c.collegeId)) errors.push('missing collegeId: ' + c.collegeId);
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
    // Specialties
    populateSelect(dom.selectSpecialty, filtersData.specialties);
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

  function getEligibleSeatCategories(cat) {
    var eligible = CATEGORY_ELIGIBILITY[cat] || [cat];
    // Add open state categories
    var openCategories = ['GEN', 'MNG', 'MQ', 'MQ1', 'OPN', 'S1A', 'UR', 'UR-GEN', 'UR-MNG', 'AGE'];
    if (cat === 'GN' || cat === 'EW' || cat === 'BC' || cat === 'SC' || cat === 'ST') {
      eligible = eligible.concat(openCategories);
    }
    if (cat === 'BC') eligible = eligible.concat(['OBC', 'OBC-Female']);
    if (cat === 'SC') eligible = eligible.concat(['SC', 'SC-Female']);
    if (cat === 'ST') eligible = eligible.concat(['ST', 'ST-Female']);
    return eligible;
  }

  function getRoundNumber(roundStr) {
    if (!roundStr) return 99;
    var m = roundStr.match(/(?:round|rd)\s*(\d+(?:\.\d+)?)/i);
    return m ? parseFloat(m[1]) : 99;
  }

  // ---- Filtering ----
  function applyFilters(userRank, userCategory, filters) {
    var eligible = getEligibleSeatCategories(userCategory);

    return cutoffsData.filter(function (row) {
      if (userCategory !== 'ALL' && eligible.indexOf(row.seatCategory) === -1) return false;
      if (row.closingRank < userRank) return false;

      // Form/sidebar filters
      if (filters.quota && row.quotaCode !== filters.quota) return false;
      if (filters.course && row.course !== filters.course) return false;
      if (filters.specialties && filters.specialties.length > 0) {
        var specArray = Array.isArray(filters.specialties) ? filters.specialties : [filters.specialties];
        if (specArray.indexOf(row.specialty) === -1) return false;
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
      if (filters.collegeType && college.collegeType !== filters.collegeType) return false;
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
        case 'rank':
          return a.cutoff.closingRank - b.cutoff.closingRank;
        case 'fee':
          return parseCurrency(a.cutoff.fee) - parseCurrency(b.cutoff.fee);
        case 'stipend':
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
      return '<span class="round-badge ' + badgeClass + '">' + roundLabel + ': <strong>' + r.closingRank.toLocaleString('en-IN') + '</strong></span>';
    }).join(' ');

    var feeHtml = '';
    if (item.cutoff.fee) {
      feeHtml = '<span class="round-badge" style="background: #eef2ff; color: #4338ca; border: 1px solid #c7d2fe;">Fee: <strong>' + escapeHtml(item.cutoff.fee) + '</strong></span>';
    }
    var stipendHtml = '';
    if (item.cutoff.stipend) {
      stipendHtml = '<span class="round-badge" style="background: #fdf4ff; color: #86198f; border: 1px solid #f5d0fe;">Stipend: <strong>' + escapeHtml(item.cutoff.stipend) + '</strong></span>';
    }

    card.innerHTML =
      '<div class="result-card-top">' +
        '<h3 class="result-college-name">' + escapeHtml(item.college.name) + '</h3>' +
      '</div>' +
      '<div class="result-course-name">' + courseStr + '</div>' +
      '<div class="result-meta-row">' +
        '<div class="meta-group"><span class="meta-label">Seat Category:</span> <span class="meta-value">' + escapeHtml(item.cutoff.seatCategory) + '</span></div>' +
        '<div class="meta-group"><span class="meta-label">Quota:</span> <span class="meta-value">' + escapeHtml(quotaLabel) + '</span></div>' +
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
    var category = dom.selectCategory.value;
    var valid = true;

    clearErrors();

    if (!rank || rank < 1 || isNaN(rank)) {
      showError('fg-rank', 'err-rank', 'Enter a valid positive rank.');
      dom.inputRank.focus();
      dom.inputRank.scrollIntoView({ behavior: 'smooth', block: 'center' });
      valid = false;
    }
    if (!category) {
      showError('fg-category', 'err-category', 'Select a category.');
      valid = false;
    }
    if (!valid) return;

    currentUserRank = rank;
    currentCategory = category;
    currentPage = 1;

    // Gather filters from form
    var filters = {
      counselling: dom.selectCounselling.value,
      state: dom.selectState.value,
      quota: dom.selectQuota.value,
      course: dom.selectCourse.value,
      specialties: tomSelectInstances['select-specialty'] ? tomSelectInstances['select-specialty'].getValue() : [],
      collegeType: dom.selectCollegeType.value,
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
      var roundItem = { round: row.round, year: row.year, closingRank: row.closingRank, prediction: calculatePrediction(rank, row.closingRank) };

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

    var filteredQuotas = filtersData.quotas.filter(function(q) {
      return validQuotas.has(q.code);
    });

    if (filteredQuotas.length === 0) {
      filteredQuotas = filtersData.quotas;
    }

    populateSelect(dom.selectQuota, filteredQuotas);
  }

  function updateSpecialtyDropdown() {
    var course = dom.selectCourse.value;
    var currentSpecialty = tomSelectInstances['select-specialty'] ? tomSelectInstances['select-specialty'].getValue() : dom.selectSpecialty.value;

    if (!course || course === '') {
      populateSelect(dom.selectSpecialty, filtersData.specialties);
    } else {
      var validSpecialties = new Set();
      if (cutoffsData) {
        cutoffsData.forEach(function (row) {
          if (row.course === course && row.specialty) {
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
    var counselling = dom.selectCounselling.value;
    var currentCollegeType = dom.selectCollegeType.value;

    if (!counselling || counselling === '') {
      populateSelect(dom.selectCollegeType, filtersData.collegeTypes);
    } else {
      var validCollegeTypes = new Set();
      if (cutoffsData && collegesMap) {
        cutoffsData.forEach(function (row) {
          var rowCounselling = row.counselling || 'All India';
          if (rowCounselling === counselling) {
            var college = collegesMap.get(row.collegeId);
            if (college && college.collegeType) {
              validCollegeTypes.add(college.collegeType);
            }
          }
        });
      }
      var validArray = Array.from(validCollegeTypes).sort();
      if (validArray.length === 0) validArray = filtersData.collegeTypes;
      populateSelect(dom.selectCollegeType, validArray);
    }
  }


  // ---- Reset ----
  function resetAll() {
    dom.form.reset();
    
    // Reset Tom Selects
    for (var id in tomSelectInstances) {
      if (tomSelectInstances.hasOwnProperty(id) && tomSelectInstances[id]) {
        if (id === 'select-category') {
           tomSelectInstances[id].setValue('GN', true);
        } else if (id === 'select-counselling') {
           tomSelectInstances[id].setValue('All India', true);
        } else {
           tomSelectInstances[id].setValue('', true);
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
  function updateUrl() {
    var params = new URLSearchParams();
    if (currentUserRank) params.set('rank', currentUserRank);
    if (currentCategory) params.set('category', currentCategory);
    if (dom.selectCounselling.value) params.set('counselling', dom.selectCounselling.value);
    if (dom.selectState.value) params.set('state', dom.selectState.value);
    if (dom.selectQuota.value) params.set('quota', dom.selectQuota.value);
    if (dom.selectCourse.value) params.set('course', dom.selectCourse.value);
    var specVal = tomSelectInstances['select-specialty'] ? tomSelectInstances['select-specialty'].getValue() : dom.selectSpecialty.value;
    if (Array.isArray(specVal) && specVal.length > 0) {
      params.set('specialty', specVal.join(','));
    } else if (typeof specVal === 'string' && specVal !== '') {
      params.set('specialty', specVal);
    }
    if (dom.selectCollegeType.value) params.set('collegeType', dom.selectCollegeType.value);
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
    setSelectValue(dom.selectCategory, params.get('category'), true);

    if (params.has('quota')) setSelectValue(dom.selectQuota, params.get('quota'), true);
    if (params.has('course')) setSelectValue(dom.selectCourse, params.get('course'), true);
    if (params.has('specialty')) {
      var specs = params.get('specialty').split(',');
      setSelectValue(dom.selectSpecialty, specs, true);
    }
    if (params.has('collegeType')) setSelectValue(dom.selectCollegeType, params.get('collegeType'), true);
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
      
      fetchCutoffs(counselling).then(function() {
        toggleStateFilter();
        updateStateDropdown();
        updateQuotaDropdown();
        updateSpecialtyDropdown();
        updateCollegeTypeDropdown();
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
