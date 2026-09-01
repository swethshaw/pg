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

  // ---- DOM Cache ----
  var dom = {};

  function cacheDom() {
    // Form
    dom.form = document.getElementById('predictor-form');
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
  function loadData() {
    dom.loadingState.classList.add('is-visible');
    dom.btnPredict.disabled = true;

    Promise.all([
      fetch('data/filters.json').then(function (r) { if (!r.ok) throw new Error('filters.json'); return r.json(); }),
      fetch('data/colleges.json').then(function (r) { if (!r.ok) throw new Error('colleges.json'); return r.json(); }),
      fetch('data/cutoffs-2025.json').then(function (r) { if (!r.ok) throw new Error('cutoffs-2025.json'); return r.json(); }),
    ]).then(function (results) {
      filtersData = results[0];
      cutoffsData = results[2];

      // Build colleges map
      collegesMap = new Map();
      results[1].forEach(function (c) { collegesMap.set(c.id, c); });

      // Generate specialties from cutoffs
      var specSet = new Set();
      cutoffsData.forEach(function (c) { if (c.specialty) specSet.add(c.specialty); });
      filtersData.specialties = Array.from(specSet).sort();

      // Build quota label map
      if (Array.isArray(filtersData.quotas)) {
        filtersData.quotas.forEach(function (q) {
          if (typeof q === 'object' && q.code) QUOTA_LABELS[q.code] = q.label || q.code;
        });
      }

      // Dev validation
      validateDataIntegrity();

      populateFormDropdowns();
      dom.selectCategory.value = 'GN';
      restoreFromUrl();
      toggleStateFilter();
      
      // Auto-run prediction on initial load
      runPrediction();

      dom.loadingState.classList.remove('is-visible');
      dom.btnPredict.disabled = false;
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
      if (c.year !== 2025) errors.push('year≠2025 at ' + i);
      if (c.authority !== 'MCC') errors.push('authority≠MCC at ' + i);
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
    var firstOpt = selectEl.options[0]; // Keep "All ..." default
    selectEl.innerHTML = '';
    selectEl.appendChild(firstOpt);
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

  function populateFormDropdowns() {
    // Categories
    populateSelect(dom.selectCategory, filtersData.categories);
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
    populateSelect(dom.selectRound, filtersData.rounds);
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
    return CATEGORY_ELIGIBILITY[cat] || [cat];
  }

  // ---- Filtering ----
  function applyFilters(userRank, userCategory, filters) {
    var eligible = getEligibleSeatCategories(userCategory);

    return cutoffsData.filter(function (row) {
      if (row.year !== 2025 || row.authority !== 'MCC') return false;
      if (eligible.indexOf(row.seatCategory) === -1) return false;
      if (row.closingRank < userRank) return false;

      // Form/sidebar filters
      if (filters.quota && row.quotaCode !== filters.quota) return false;
      if (filters.course && row.course !== filters.course) return false;
      if (filters.specialty && row.specialty !== filters.specialty) return false;
      if (filters.round && row.round !== filters.round) return false;
      if (filters.counselling && row.counselling && row.counselling !== filters.counselling) return false;

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



    var locationParts = [];
    if (item.college.city) locationParts.push(escapeHtml(item.college.city));
    if (item.college.state) locationParts.push(escapeHtml(item.college.state));
    var locationStr = locationParts.join(', ');
    if (item.college.collegeType) locationStr += ' · ' + escapeHtml(item.college.collegeType);

    var quotaLabel = QUOTA_LABELS[item.cutoff.quotaCode] || item.cutoff.quotaCode;

    card.innerHTML =
      '<div class="result-card-header">' +
        '<div>' +
          '<div class="result-college-name">' + escapeHtml(item.college.name) + '</div>' +
          '<div class="result-location">' + locationStr + '</div>' +
          '<div class="result-course-line">' + escapeHtml(item.cutoff.course) + ' · ' + escapeHtml(item.cutoff.specialty) + '</div>' +
          '<div class="result-quota-line">' + escapeHtml(quotaLabel) + ' · ' + escapeHtml(item.cutoff.seatCategory) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="result-meta">' +
        '<div class="result-meta-item">' +
          '<span class="result-meta-label">Closing Rank</span>' +
          '<span class="result-meta-value">' + formatNumber(item.cutoff.closingRank) + '</span>' +
        '</div>' +
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
      specialty: dom.selectSpecialty.value,
      collegeType: dom.selectCollegeType.value,
      round: dom.selectRound.value,
    };

    // Filter
    var filtered = applyFilters(rank, category, filters);

    // Enrich with college data and predictions
    var enriched = [];
    filtered.forEach(function (row) {
      var college = collegesMap.get(row.collegeId);
      if (!college) return;
      enriched.push({
        cutoff: row,
        college: college,
        prediction: calculatePrediction(rank, row.closingRank),
      });
    });

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

    if (counselling === '' || counselling === 'Open States') {
      stateGroup.style.display = 'block';
    } else {
      stateGroup.style.display = 'none';
      dom.selectState.value = '';
    }
  }

  // ---- Reset ----
  function resetAll() {
    dom.form.reset();
    dom.selectCategory.value = 'GN';
    if (dom.selectState) dom.selectState.value = '';
    if (dom.selectSort) dom.selectSort.value = 'prediction';
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
    if (dom.selectSpecialty.value) params.set('specialty', dom.selectSpecialty.value);
    if (dom.selectRound.value) params.set('round', dom.selectRound.value);
    if (dom.selectCollegeType.value) params.set('collegeType', dom.selectCollegeType.value);

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
    dom.selectCategory.value = params.get('category');

    if (params.has('quota')) dom.selectQuota.value = params.get('quota');
    if (params.has('course')) dom.selectCourse.value = params.get('course');
    if (params.has('specialty')) dom.selectSpecialty.value = params.get('specialty');
    if (params.has('round')) dom.selectRound.value = params.get('round');
    if (params.has('collegeType')) dom.selectCollegeType.value = params.get('collegeType');
    if (params.has('counselling')) dom.selectCounselling.value = params.get('counselling');
    if (params.has('state')) dom.selectState.value = params.get('state');
  }

  // ---- Event Binding ----
  function bindEvents() {
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

    // Filter changes → refilter automatically
    [dom.selectCounselling, dom.selectState, dom.selectQuota, dom.selectCourse, dom.selectSpecialty,
     dom.selectCollegeType, dom.selectRound].forEach(function (sel) {
      sel.addEventListener('change', autoPredict);
    });

    dom.selectCounselling.addEventListener('change', toggleStateFilter);

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
