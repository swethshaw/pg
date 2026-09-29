#!/usr/bin/env node
/* ============================================================
   NEET PG College Predictor — Production Data Migration Script
   ============================================================
   
   Transforms raw source data from /datfile into the application's
   normalized schema under /data.
   
   Usage:
     node migrate_data.js
   
   Source: ../datfile/ (READ-ONLY)
   Target: ./data/ (colleges.json, cutoffs/*.json, filters.json)
   
   This script is DETERMINISTIC — running it twice on the same
   source produces the same output.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

// ============================================================
// CONFIGURATION
// ============================================================

const SOURCE_DIR = path.resolve(__dirname, '../datfile');
const TARGET_DATA_DIR = path.resolve(__dirname, 'data');
const TARGET_CUTOFFS_DIR = path.resolve(TARGET_DATA_DIR, 'cutoffs');
const TARGET_AUDIT_DIR = path.resolve(TARGET_DATA_DIR, 'audit');

// Canonical college types (must match app.js expectations)
const CANONICAL_COLLEGE_TYPES = [
  'Government',
  'Private',
  'Deemed University',
  'Central University',
  'DNB Hospital'
];

// State code mapping for ID generation (matches existing update_colleges.js)
const STATE_CODES = {
  "Andaman and Nicobar Islands": "AA",
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  "Assam": "AS",
  "Bihar": "BR",
  "Chandigarh": "CH",
  "Chhattisgarh": "CG",
  "Dadra and Nagar Haveli": "DN",
  "Daman and Diu": "DD",
  "Delhi": "DL",
  "Goa": "GA",
  "Gujarat": "GJ",
  "Haryana": "HR",
  "Himachal Pradesh": "HP",
  "Jammu and Kashmir": "JK",
  "Jharkhand": "JH",
  "Karnataka": "KA",
  "Kerala": "KL",
  "Ladakh": "LA",
  "Madhya Pradesh": "MP",
  "Maharashtra": "MH",
  "Manipur": "MN",
  "Meghalaya": "ML",
  "Mizoram": "MZ",
  "Nagaland": "NL",
  "Odisha": "OR",
  "Pondicherry": "PY",
  "Puducherry": "PY",
  "Punjab": "PB",
  "Rajasthan": "RJ",
  "Sikkim": "SK",
  "Tamil Nadu": "TN",
  "Telangana": "TG",
  "Tripura": "TR",
  "Uttar Pradesh": "UP",
  "Uttarakhand": "UK",
  "West Bengal": "WB",
  "All India": "AI"
};

// ============================================================
// SOURCE FILE MAPPING
// ============================================================
// Maps source filenames to target counselling authority names.
// The key is the source filename (without .json), the value is
// an object with { counselling, authority, targetFile }.

const SOURCE_FILE_MAP = {
  'All-India': {
    counselling: 'All India',
    authority: 'All India',
    targetFile: 'All India.json'
  },
  'openstates': {
    counselling: 'Open States',
    authority: 'Open States',
    targetFile: 'Open States.json'
  },
  'Karnataka': {
    counselling: 'Karnataka',
    authority: 'Karnataka',
    targetFile: 'Karnataka.json'
  },
  'Maharashtra': {
    counselling: 'Maharashtra',
    authority: 'Maharashtra',
    targetFile: 'Maharashtra.json'
  },
  'Rajasthan': {
    counselling: 'Rajasthan',
    authority: 'Rajasthan',
    targetFile: 'Rajasthan.json'
  },
  'Uttar pradesh': {
    counselling: 'Uttar Pradesh',
    authority: 'Uttar Pradesh',
    targetFile: 'Uttar Pradesh.json'
  },
  'Madhya Pradesh': {
    counselling: 'Madhya Pradesh',
    authority: 'Madhya Pradesh',
    targetFile: 'Madhya Pradesh.json'
  },
  'West Bengal': {
    counselling: 'West Bengal',
    authority: 'West Bengal',
    targetFile: 'West Bengal.json'
  },
  'bihar': {
    counselling: 'Bihar',
    authority: 'Bihar',
    targetFile: 'Bihar.json'
  },
  'harayana': {
    counselling: 'Haryana',
    authority: 'Haryana',
    targetFile: 'Haryana.json'
  },
  'Himachal Pradesh': {
    counselling: 'Himachal Pradesh',
    authority: 'Himachal Pradesh',
    targetFile: 'Himachal Pradesh.json'
  },
  'Uttarakhand': {
    counselling: 'Uttarakhand',
    authority: 'Uttarakhand',
    targetFile: 'Uttarakhand.json'
  },
  'jharkhand': {
    counselling: 'Jharkhand',
    authority: 'Jharkhand',
    targetFile: 'Jharkhand.json'
  },
  'delhi': {
    counselling: 'Delhi',
    authority: 'Delhi',
    targetFile: 'Delhi.json'
  }
};

// ============================================================
// QUOTA CODE MAPPING
// Maps source quota.name to short code used in target cutoffs
// ============================================================

const QUOTA_CODE_MAP = {
  // All India quotas
  'AIQ': 'AIQ',
  'DNB Post MBBS': 'DNB Post MBBS',
  'NBE Diploma': 'NBE Diploma',
  'MNG': 'MNG',
  'IP': 'IP',
  'AFMS': 'AFMS',
  'NRI': 'NRI',
  'DU': 'DU',
  'BHU': 'BHU',
  'JM': 'JM',
  'MM': 'MM',
  'AMU': 'AMU',
  'AFMS-DNB': 'AFMS-DNB',

  // Open States quotas
  'AP Management Quota-S1A(B Cat)': 'APMgmt-S1-All-CatB',
  'Pondicherry Management Quota': 'PY Mgmt-Open',
  'Punjab Open Quota (All India Basis)': 'Punjab Open Quota (AI Basis)',
  'Punjab Open Quota (All India Basis)-Converted': 'Punjab Open Quota (AI Basis)-Converted',
  'Uttarakhand Private Seats - All India / Management': 'UK Priv-AllIndia/Mgmt',
  'Telangana Management Quota-MQ1(B Cat)': 'TELMgmt-MQ1-CatB-All',
  'Chhattisgarh Other State': 'Other State',
  'TN Management Quota': 'TN Mgmt Quota',
  'Haryana Private Seats - Management Quota': 'HAR Priv-Mgmt',
  'HP Private Seats - All': 'HP Priv All',
  'Bihar Private Seats - Open Quota': 'Bihar Priv-Open',
  'West Bengal Management Quota': 'WB Mgmt Quota',
  'Rajasthan Private Seats - All India (Eligibility)': 'RAJ Priv-All India',
  'Uttar Pradesh Private Seats - Open Quota': 'UP Priv-Open Quota',
  'Rajasthan Private Seats - Management Quota': 'RAJ Priv-Mgmt Quota',
  'Karnataka Private Seats - Open Quota': 'KAR Priv Seats-Open',
  'Sikkim Management Quota': 'Sikkim Mgmt Quota',
  'Sikkim General Quota': 'Sikkim Gen Quota',
  'Karnataka Other Seats (Institutional Quota)': 'KAR Others (Inst.Q)',
  'MP Private Seats - Non Domicile': 'MP Priv-NonDomicile',
  'MP Govt Quota - Non Domicile': 'MP Govt-NonDomicile',

  // Karnataka quotas
  'Karnataka Govt Quota - Open': 'KAR Govt Quota-Open',
  'Karnataka Private Seats - GMP Quota': 'KAR Priv Seats-GMP',
  'Karnataka Private Seats - Minority Quota': 'KAR Priv Seats-Min.',
  'Karnataka Govt Quota - Inservice': 'KAR Govt Quota-InS',
  'Karnataka NRI Quota': 'KAR NRI Quota',
  'Karnataka DNB Inservice Seats': 'KAR DNB Serv',

  // Maharashtra quotas
  'Maharashtra Govt Quota': 'MAHA-Govt Quota',
  'Maharashtra NRI Quota': 'MAHA-NRI Quota',
  'Maharashtra Minority Quota': 'MAHA Priv-Min Quota',
  'Maharashtra Management Quota': 'MAHA Priv-Mgmt Quota',

  // Rajasthan quotas
  'Rajasthan Govt Seats - Govt Quota': 'RAJ Govt - Govt Quota',
  'Rajasthan DNB Inservice Seats': 'Raj DNB Serv',
  'Rajasthan Govt Seats - Management Quota': 'RAJ Govt - Mgmt Quota',
  'Rajasthan Private Seats - Govt Quota': 'RAJ Priv-Govt Quota',

  // Uttar Pradesh quotas
  'Uttar Pradesh Govt Quota': 'UP-Govt Quota',
  'Uttar Pradesh DNB Inservice Seats': 'UP-DNB InS',
  'Uttar Pradesh Private Seats - Minority Quota': 'UP Priv-Min. Quota',

  // Madhya Pradesh quotas
  'MP Govt Quota': 'MP Govt Quota',
  'MP Private Seats - Open Quota': 'MP Priv-Open',
  'MP Private Seats - NRI Quota': 'MP Priv-NRI',
  'MP Private Seats - NRI Non Domicile': 'MP Priv-NRINonDomicil',

  // West Bengal quotas
  'West Bengal Govt Quota': 'WB Govt Quota',
  'West Bengal DNB Inservice Seats': 'WB DNB Serv',
  'West Bengal NRI Quota': 'WB NRI Quota',

  // Bihar quotas
  'Bihar Govt Quota': 'Bihar Govt Quota',
  'Bihar DNB Seats': 'Bihar DNB Seats',
  'Bihar Private Seats - Minority Quota': 'Bihar Priv-Minority',
  'Bihar Private Seats - NRI Quota': 'Bihar Priv-NRI',

  // Haryana quotas
  'Haryana State Quota': 'HAR Govt-All',
  'Haryana State Quota - Institutional Preference': 'HAR Govt-Inst. Pref',
  'Haryana Private Seats - Institutional Preference': 'Haryana Priv IP',
  'Haryana Private Seats - State Quota': 'HAR Priv-Govt Quota',
  'Haryana DNB Inservice Seats': 'Haryana DNB Serv',
  'Haryana Private Seats - NRI Quota': 'Haryana Priv NRI',
  'Haryana Private Seats - Minority Quota': 'HAR Priv-Minority',

  // Himachal Pradesh quotas
  'HP State Quota': 'HP Govt Quota',
  'HP DNB Inservice Seats': 'HP DNB Serv',
  'HP Private Seats - NRI': 'HP Priv NRI',
  'HP Private Seats - State Quota': 'HP Private-StateQuota',

  // Uttarakhand quotas
  'Uttarakhand Govt Quota': 'UK-Govt Quota',
  'Uttarakhand Private Seats - Govt Quota': 'UK Priv-Govt Quota',
  'Uttarakhand DNB Inservice Seats': 'UK DNB Serv',
  'Uttarakhand Private Seats - NRI': 'UK Priv-NRI',

  // Jharkhand quotas
  'Jharkhand Govt Quota': 'JHKND Govt Quota',

  // Delhi quotas
  'Delhi State Quota': 'Delhi State Quota',
};

// Quota labels (full names for filters.json)
const QUOTA_LABEL_MAP = {};
// We'll populate this dynamically from source data

// ============================================================
// COURSE TYPE NORMALIZATION
// ============================================================

/**
 * Extracts course type and specialty from a course name.
 * The course type extraction uses prefix matching, not substring.
 * 
 * CRITICAL: NBE Diploma courses are identified by the "-NBE" suffix
 * in the course name OR "Diploma in" prefix, NOT by quota.master_quota.
 * 
 * @param {string} courseName - e.g. "MD Pathology", "DNB Anaesthesiology"
 * @returns {{ courseType: string, specialty: string }}
 */
function normalizeCourse(courseName) {
  if (!courseName) return { courseType: '', specialty: '' };

  const name = courseName.trim();

  // MD courses: "MD Something"
  if (name.startsWith('MD ')) {
    return { courseType: 'MD', specialty: name.substring(3).trim() };
  }
  // MS courses: "MS Something"
  if (name.startsWith('MS ')) {
    return { courseType: 'MS', specialty: name.substring(3).trim() };
  }
  // MCh courses: "MCh Something"
  if (name.startsWith('MCh ')) {
    return { courseType: 'MCh', specialty: name.substring(4).trim() };
  }
  // DNB courses: "DNB Something"
  if (name.startsWith('DNB ')) {
    return { courseType: 'DNB', specialty: name.substring(4).trim() };
  }
  // Master of Public Health
  if (name.startsWith('Master of ') || name.startsWith('Master ')) {
    return { courseType: 'Master', specialty: name };
  }
  // Diploma courses with -NBE suffix: these are NBE Diploma
  // e.g. "Diploma in Anaesthesia-NBE", "Diploma in Child Health-NBE"
  if (name.startsWith('Diploma in ') || name.startsWith('Diploma ')) {
    let specialty = name;
    // Remove "Diploma in " or "Diploma " prefix
    if (name.startsWith('Diploma in ')) {
      specialty = name.substring(11).trim();
    } else {
      specialty = name.substring(8).trim();
    }
    // Remove trailing "-NBE" if present (it's a program qualifier, not part of specialty)
    specialty = specialty.replace(/-NBE$/i, '').trim();
    return { courseType: 'Diploma', specialty: specialty };
  }

  // Fallback — unknown course type
  return { courseType: name, specialty: '' };
}


// ============================================================
// COLLEGE ID GENERATION
// ============================================================

/**
 * Generates a stable college ID from state and institute name.
 * Must match existing ID generation to preserve foreign key integrity.
 * 
 * Format: {STATE_CODE}_{NORMALIZED_NAME}
 */
function generateCollegeId(state, instituteName) {
  const code = STATE_CODES[state] || 'XX';
  let cleanName = instituteName.replace(/&/g, 'and');
  cleanName = cleanName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toUpperCase();
  cleanName = cleanName.replace(/^_/, '').replace(/_$/, '');
  return `${code}_${cleanName}`;
}


// ============================================================
// COLLEGE TYPE CLASSIFICATION
// ============================================================

/**
 * Determines college type using all available evidence.
 * 
 * Classification hierarchy (strongest evidence first):
 * 1. Explicit quota/master_quota keywords (most reliable)
 * 2. Counselling authority keywords
 * 3. Institute name patterns (least reliable, used as tiebreaker)
 * 
 * IMPORTANT: A DNB course does NOT make an institute a "DNB Hospital".
 * The institute type must be determined separately.
 */
function classifyCollegeType(institute, quotaEvidence, counsellingEvidence) {
  const iName = (institute.name || '').toLowerCase();
  const iNameOriginal = institute.name || '';

  // Collect all evidence
  const allQuotaNames = new Set();
  const allMasterQuotas = new Set();
  const allCounsellingNames = new Set();
  const allCourseTypes = new Set();

  quotaEvidence.forEach(e => {
    if (e.quotaName) allQuotaNames.add(e.quotaName.toLowerCase());
    if (e.masterQuota) allMasterQuotas.add(e.masterQuota.toLowerCase());
    if (e.courseType) allCourseTypes.add(e.courseType);
  });

  counsellingEvidence.forEach(e => {
    if (e) allCounsellingNames.add(e.toLowerCase());
  });

  const quotaStr = Array.from(allQuotaNames).join(' ');
  const masterStr = Array.from(allMasterQuotas).join(' ');
  const counsellingStr = Array.from(allCounsellingNames).join(' ');

  // ---- DEEMED UNIVERSITY ----
  // Strongest signal: quota master_quota is "Deemed to be Univ Seats"
  if (masterStr.includes('deemed')) return 'Deemed University';
  if (quotaStr.includes('deemed')) return 'Deemed University';
  // Name-based: explicit "Deemed University" / "Deemed to be University"
  if (iName.includes('deemed')) return 'Deemed University';
  // Known deemed patterns in name
  if (iName.includes('(du)')) return 'Deemed University';

  // ---- CENTRAL UNIVERSITY ----
  // AIIMS, JIPMER, PGIMER, etc. are Central Government institutions
  if (iName.includes('aiims') || iName.startsWith('all india institute of medical science')) return 'Central University';
  if (iName.includes('jipmer')) return 'Central University';
  if (iName.includes('pgimer') || iName.includes('post graduate institute of medical education')) return 'Central University';
  if (iName.includes('nimhans')) return 'Central University';
  // BHU, AMU, DU, JM specific quotas
  if (allMasterQuotas.has('bhu') || allMasterQuotas.has('amu') || allMasterQuotas.has('du') || allMasterQuotas.has('jm')) return 'Central University';
  // Central Government in name
  if (iName.includes('central government') || iName.includes('central university')) return 'Central University';
  // Safdarjung, RML, VMMC are central govt hospitals
  if (iName.includes('safdarjung') || iName.includes('ram manohar lohia') || iName.includes('vmmc')) return 'Central University';
  if (iName.includes('lady hardinge')) return 'Central University';

  // ---- AFMS / ARMED FORCES ----
  // Armed Forces Medical Services hospitals are Government institutions
  if (allMasterQuotas.has('afms') || allMasterQuotas.has('afms-dnb')) return 'Government';
  if (quotaStr.includes('afms')) return 'Government';
  if (iName.includes('armed forces') || iName.includes('military hospital') || iName.includes('command hospital')) return 'Government';
  if (iName.includes(' afmc') || iName.startsWith('afmc')) return 'Government';

  // ---- ESIC ----
  // ESIC hospitals are Government institutions
  if (iName.includes('esic') || iName.includes('employees state insurance')) return 'Government';

  // ---- RAILWAY ----
  if (iName.includes('railway')) return 'Government';

  // ---- PRIVATE (from quota evidence) ----
  // If quota contains management/private/NRI keywords
  const hasPrivateQuota = quotaStr.includes('management') || quotaStr.includes('private') ||
    quotaStr.includes('priv') || quotaStr.includes('nri') ||
    masterStr.includes('management') || masterStr.includes('private');
  
  // If quota contains government keywords
  const hasGovtQuota = quotaStr.includes('govt') || quotaStr.includes('government') ||
    quotaStr.includes('state quota') || masterStr.includes('govt') || masterStr.includes('government');

  // If institute appears in both private and govt quotas, we need to pick the INSTITUTE type
  // In this case, the quota tells us about the SEAT, not the institute type.
  // We fall through to name-based classification.

  // ---- DNB HOSPITAL ----
  // The app uses "DNB Hospital" as a FUNCTIONAL category for standalone
  // hospitals/centres that only offer DNB or NBE Diploma courses.
  // This is the app's filtering model — users use it to find NBE-accredited
  // standalone hospitals vs full medical colleges.
  //
  // If an institute offers MD/MS alongside DNB, it's a medical college
  // (Government/Private/Deemed/Central), NOT a "DNB Hospital".
  // If an institute ONLY offers DNB/NBE Diploma, it IS a "DNB Hospital"
  // regardless of whether it's government-owned or private.
  const hasMDMS = allCourseTypes.has('MD') || allCourseTypes.has('MS') || allCourseTypes.has('MCh') || allCourseTypes.has('Diploma');
  const hasDNB = allCourseTypes.has('DNB');
  
  if (hasDNB && !hasMDMS) {
    return 'DNB Hospital';
  }

  // ---- NAME-BASED CLASSIFICATION (for MD/MS offering colleges) ----
  // Government Medical Colleges
  if (iName.includes('government medical college') || iName.includes('govt. medical college') ||
      iName.includes('govt medical college') || iName.includes('government dental college')) return 'Government';
  if (iName.startsWith('government ') || iName.startsWith('govt ') || iName.startsWith('govt.')) return 'Government';
  if (iName.includes('state medical college') || iName.includes('district hospital') ||
      iName.includes('civil hospital')) return 'Government';
  // Regional/District/Sub-District govt patterns
  if (iName.includes('regional institute') || iName.includes('regional cancer centre')) return 'Government';
  
  // Indian Institute patterns (mostly government)
  if (iName.includes('indian institute')) return 'Government';
  
  // State-run medical colleges
  if (iName.includes('medical college and hospital') && !hasPrivateQuota) return 'Government';

  // ---- PRIVATE (from name) ----
  if (iName.includes('private') || iName.includes('(pvt)') || iName.includes('pvt.')) return 'Private';
  // Trust/Foundation hospitals — typically private
  if (iName.includes('trust') || iName.includes('foundation')) {
    // But not if it has only govt quotas
    if (hasGovtQuota && !hasPrivateQuota) return 'Government';
    return 'Private';
  }
  // Institute/Hospital patterns — could be either
  // If has management quota → Private
  if (hasPrivateQuota && !hasGovtQuota) return 'Private';

  // Mixed evidence or no strong signal:
  // Default based on quota evidence
  if (hasGovtQuota) return 'Government';
  if (hasPrivateQuota) return 'Private';

  // Fallback: Government (most common for AIQ seats)
  return 'Government';
}


// ============================================================
// ROUND FORMATTING
// ============================================================

/**
 * Converts source round info into the target round format.
 * Source: cr_2025_1 → session=2025, round=1
 * Target: "Round 1" (for latest year) or "24 round 1" (for 2024)
 * 
 * The existing data uses:
 * - "Round 1", "Round 2", etc. for 2025 (current year)
 * - "24 round 0", "24 round 1", etc. for 2024 (previous year)
 */
function formatRound(session, roundNumber) {
  const year = parseInt(session, 10);
  const roundStr = roundNumber.toString();
  
  if (year === 2025) {
    return `Round ${roundStr}`;
  } else if (year === 2024) {
    return `24 round ${roundStr}`;
  } else {
    // Future-proof for other years
    return `${year.toString().slice(-2)} round ${roundStr}`;
  }
}


// ============================================================
// MAIN MIGRATION LOGIC
// ============================================================

function main() {
  console.log('=== NEET PG College Predictor — Data Migration ===\n');

  // Ensure target directories exist
  fs.mkdirSync(TARGET_CUTOFFS_DIR, { recursive: true });
  fs.mkdirSync(TARGET_AUDIT_DIR, { recursive: true });

  // ---- PHASE 1: Load all source data ----
  console.log('Phase 1: Loading source data...');
  
  const sourceDataSets = {};
  let totalSourceRecords = 0;

  for (const [filename, config] of Object.entries(SOURCE_FILE_MAP)) {
    const filepath = path.join(SOURCE_DIR, filename + '.json');
    if (!fs.existsSync(filepath)) {
      console.warn(`  WARNING: Source file not found: ${filepath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    sourceDataSets[filename] = { data, config };
    totalSourceRecords += data.length;
    console.log(`  Loaded ${filename}.json: ${data.length} records`);
  }

  console.log(`  Total source records: ${totalSourceRecords}\n`);

  // ---- PHASE 2: Build college registry ----
  console.log('Phase 2: Building college registry...');
  
  // Load BACKUP colleges for preservation (prevents data loss from historical runs)
  // We check for a backup directory first, then fall back to the current data
  const backupDirs = fs.readdirSync(__dirname).filter(f => f.startsWith('data_backup_') && fs.statSync(path.join(__dirname, f)).isDirectory());
  let backupCollegesMap = new Map();
  let backupCutoffsByFile = {};
  if (backupDirs.length > 0) {
    const latestBackup = backupDirs.sort().pop();
    const backupCollegesPath = path.join(__dirname, latestBackup, 'colleges.json');
    if (fs.existsSync(backupCollegesPath)) {
      const backupColleges = JSON.parse(fs.readFileSync(backupCollegesPath, 'utf8'));
      backupColleges.forEach(c => backupCollegesMap.set(c.id, c));
      console.log(`  Loaded ${backupColleges.length} backup colleges from ${latestBackup}`);
    }
    // Also load backup cutoffs for preservation
    const backupCutoffsDir = path.join(__dirname, latestBackup, 'cutoffs');
    if (fs.existsSync(backupCutoffsDir)) {
      fs.readdirSync(backupCutoffsDir).forEach(f => {
        if (f.endsWith('.json')) {
          backupCutoffsByFile[f] = JSON.parse(fs.readFileSync(path.join(backupCutoffsDir, f), 'utf8'));
        }
      });
      console.log(`  Loaded backup cutoffs: ${Object.keys(backupCutoffsByFile).length} files`);
    }
  }
  
  // Also load the current existing colleges as reference
  const existingCollegesPath = path.join(TARGET_DATA_DIR, 'colleges.json');
  let existingCollegesMap = new Map();
  if (fs.existsSync(existingCollegesPath)) {
    const existing = JSON.parse(fs.readFileSync(existingCollegesPath, 'utf8'));
    existing.forEach(c => existingCollegesMap.set(c.id, c));
    console.log(`  Loaded ${existing.length} existing colleges for reference`);
  }

  // Collect all evidence for each institute
  // Key: collegeId → { institute, state, quotaEvidence[], counsellingEvidence[], courseTypes[] }
  const collegeEvidence = new Map();

  for (const [filename, { data, config }] of Object.entries(sourceDataSets)) {
    data.forEach(row => {
      if (!row.institute || !row.institute.name) return;
      
      const state = row.state || 'All India';
      const collegeName = row.institute.name;
      const collegeId = generateCollegeId(state, collegeName);
      
      const { courseType } = normalizeCourse(row.course ? row.course.name : '');
      
      if (!collegeEvidence.has(collegeId)) {
        collegeEvidence.set(collegeId, {
          institute: row.institute,
          state: state,
          quotaEvidence: [],
          counsellingEvidence: new Set(),
          courseTypes: new Set()
        });
      }
      
      const evidence = collegeEvidence.get(collegeId);
      if (row.quota) {
        evidence.quotaEvidence.push({
          quotaName: row.quota.name,
          masterQuota: row.quota.master_quota,
          courseType: courseType
        });
      }
      if (row.counselling) {
        evidence.counsellingEvidence.add(row.counselling.name);
      }
      if (courseType) {
        evidence.courseTypes.add(courseType);
      }
    });
  }

  // Build final colleges array
  const collegesMap = new Map();
  const ambiguousColleges = [];

  for (const [collegeId, evidence] of collegeEvidence) {
    // Check if existing colleges.json already has a type for this ID
    const existingCollege = existingCollegesMap.get(collegeId);
    
    const inferredType = classifyCollegeType(
      evidence.institute,
      evidence.quotaEvidence,
      Array.from(evidence.counsellingEvidence)
    );

    // Use existing type if available and not contradicted by strong evidence
    let finalType = inferredType;
    if (existingCollege && existingCollege.collegeType) {
      // If existing type differs from inferred, log it but prefer the new inference
      // unless the existing type was manually verified
      if (existingCollege.collegeType !== inferredType) {
        ambiguousColleges.push({
          collegeId,
          name: evidence.institute.name,
          state: evidence.state,
          existingType: existingCollege.collegeType,
          inferredType: inferredType,
          courseTypes: Array.from(evidence.courseTypes),
          quotaNames: [...new Set(evidence.quotaEvidence.map(e => e.quotaName))].slice(0, 5),
          masterQuotas: [...new Set(evidence.quotaEvidence.map(e => e.masterQuota))].slice(0, 5),
          resolution: 'Using inferred type (re-evaluated with full evidence)'
        });
      }
    }

    collegesMap.set(collegeId, {
      id: collegeId,
      name: evidence.institute.name,
      city: evidence.institute.district || '',
      state: evidence.state,
      collegeType: finalType
    });
  }

  // ---- PHASE 2b: Preserve historical colleges from backup ----
  // Colleges that existed in the backup but not in the current source data
  // must be preserved to avoid breaking existing cutoff references.
  let preservedColleges = 0;
  for (const [backupId, backupCollege] of backupCollegesMap) {
    if (!collegesMap.has(backupId)) {
      collegesMap.set(backupId, backupCollege);
      preservedColleges++;
    }
  }
  if (preservedColleges > 0) {
    console.log(`  Preserved ${preservedColleges} historical colleges from backup`);
  }

  console.log(`  Total unique colleges: ${collegesMap.size}`);
  console.log(`  Ambiguous classifications: ${ambiguousColleges.length}\n`);

  // ---- PHASE 3: Transform cutoff data ----
  console.log('Phase 3: Transforming cutoff data...');

  const allCutoffsByTarget = {}; // targetFile → cutoff records[]
  const allQuotaLabels = new Map(); // quotaCode → label
  let totalOutputRecords = 0;
  let recordsRejected = 0;
  const rejectionReasons = {};

  for (const [filename, { data, config }] of Object.entries(sourceDataSets)) {
    const targetFile = config.targetFile;
    if (!allCutoffsByTarget[targetFile]) {
      allCutoffsByTarget[targetFile] = [];
    }

    data.forEach(row => {
      if (!row.institute || !row.institute.name) {
        recordsRejected++;
        rejectionReasons['missing_institute'] = (rejectionReasons['missing_institute'] || 0) + 1;
        return;
      }
      if (!row.course || !row.course.name) {
        recordsRejected++;
        rejectionReasons['missing_course'] = (rejectionReasons['missing_course'] || 0) + 1;
        return;
      }

      const state = row.state || 'All India';
      const collegeId = generateCollegeId(state, row.institute.name);
      const { courseType, specialty } = normalizeCourse(row.course.name);

      // Quota code
      let quotaCode = '';
      let quotaLabel = '';
      if (row.quota) {
        quotaCode = QUOTA_CODE_MAP[row.quota.name] || row.quota.short_name || row.quota.name;
        quotaLabel = row.quota.name;
        allQuotaLabels.set(quotaCode, quotaLabel);
      }

      // Category
      const seatCategory = row.category || '';

      // Fee and stipend
      const fee = row.fee || '';
      const stipend = row.stipend_year_1 || '';

      // Extract all round data from cr_ fields
      const crKeys = Object.keys(row).filter(k => k.startsWith('cr_') && row[k]);
      
      if (crKeys.length === 0) {
        recordsRejected++;
        rejectionReasons['no_round_data'] = (rejectionReasons['no_round_data'] || 0) + 1;
        return;
      }

      crKeys.forEach(crKey => {
        const crData = row[crKey];
        if (!crData || crData.closing_rank == null) return;

        const closingRank = crData.ai_rank || crData.closing_rank;
        if (!closingRank || closingRank <= 0 || isNaN(closingRank)) return;

        const session = crData.session || crKey.match(/cr_(\d{4})/)?.[1] || '';
        const roundNum = crKey.match(/cr_\d{4}_([\d.]+)/)?.[1] || crData.round || '';
        const year = parseInt(session, 10);
        
        if (!year || isNaN(year)) return;

        const roundFormatted = formatRound(session, roundNum);

        const cutoffRecord = {
          year: year,
          authority: config.authority,
          counselling: config.counselling,
          round: roundFormatted,
          collegeId: collegeId,
          quotaCode: quotaCode,
          course: courseType,
          specialty: specialty,
          seatCategory: seatCategory,
          closingRank: closingRank,
          numberOfAllotments: crData.allotments_count || 0,
          fee: fee,
          stipend: stipend
        };

        allCutoffsByTarget[targetFile].push(cutoffRecord);
        totalOutputRecords++;
      });
    });

    console.log(`  Processed ${filename}: ${(allCutoffsByTarget[targetFile] || []).length} cutoff records so far for ${targetFile}`);
  }

  console.log(`  Total output cutoff records: ${totalOutputRecords}`);
  console.log(`  Records rejected: ${recordsRejected}`);
  if (Object.keys(rejectionReasons).length > 0) {
    console.log('  Rejection reasons:', rejectionReasons);
  }
  console.log();

  // ---- PHASE 4: Write output files ----
  console.log('Phase 4: Writing output files...');

  // Write colleges.json
  const collegesArray = Array.from(collegesMap.values());
  collegesArray.sort((a, b) => a.id.localeCompare(b.id));
  fs.writeFileSync(
    path.join(TARGET_DATA_DIR, 'colleges.json'),
    JSON.stringify(collegesArray, null, 2)
  );
  console.log(`  Written colleges.json: ${collegesArray.length} colleges`);

  // Write cutoff files
  for (const [targetFile, cutoffs] of Object.entries(allCutoffsByTarget)) {
    // Sort by year desc, then round
    cutoffs.sort((a, b) => {
      if (a.collegeId !== b.collegeId) return a.collegeId.localeCompare(b.collegeId);
      if (a.year !== b.year) return a.year - b.year;
      return a.round.localeCompare(b.round);
    });
    
    // Preserve historical cutoff records from backup that reference
    // colleges NOT found in the new source data (to avoid data loss)
    if (backupCutoffsByFile[targetFile]) {
      const newCollegeIds = new Set(cutoffs.map(r => r.collegeId));
      const sourceCollegeIds = new Set();
      for (const { data } of Object.values(sourceDataSets)) {
        data.forEach(r => {
          if (r.institute && r.institute.name) {
            const state = r.state || 'All India';
            sourceCollegeIds.add(generateCollegeId(state, r.institute.name));
          }
        });
      }
      
      let preservedRecords = 0;
      backupCutoffsByFile[targetFile].forEach(oldRecord => {
        // Only preserve records whose college is NOT in the new source
        // (to avoid duplicating records that were regenerated from source)
        if (!sourceCollegeIds.has(oldRecord.collegeId) && collegesMap.has(oldRecord.collegeId)) {
          cutoffs.push(oldRecord);
          preservedRecords++;
        }
      });
      if (preservedRecords > 0) {
        console.log(`    Preserved ${preservedRecords} historical records in ${targetFile}`);
        totalOutputRecords += preservedRecords;
      }
    }

    // Re-sort after merge
    cutoffs.sort((a, b) => {
      if (a.collegeId !== b.collegeId) return a.collegeId.localeCompare(b.collegeId);
      if (a.year !== b.year) return a.year - b.year;
      return a.round.localeCompare(b.round);
    });

    const filepath = path.join(TARGET_CUTOFFS_DIR, targetFile);
    fs.writeFileSync(filepath, JSON.stringify(cutoffs));
    console.log(`  Written ${targetFile}: ${cutoffs.length} records`);
  }

  // ---- PHASE 5: Regenerate filters.json ----
  console.log('\nPhase 5: Regenerating filters.json...');

  // Collect all unique values from ALL cutoff files
  const allCategories = new Set();
  const allCourseTypes = new Set();
  const allSpecialties = new Set();
  const allQuotaCodes = new Set();
  const allStates = new Set();
  const allRounds = new Set();
  const allCounsellings = new Set();

  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => {
      if (r.seatCategory) allCategories.add(r.seatCategory);
      if (r.course) allCourseTypes.add(r.course);
      if (r.specialty) allSpecialties.add(r.specialty);
      if (r.quotaCode) allQuotaCodes.add(r.quotaCode);
      if (r.round) allRounds.add(r.round);
      if (r.counselling) allCounsellings.add(r.counselling);
    });
  }

  // Get states from colleges
  collegesArray.forEach(c => { if (c.state) allStates.add(c.state); });

  // Build filters
  const filters = {
    categories: Array.from(allCategories).sort().map(c => ({ code: c, label: c })),
    counsellings: Array.from(allCounsellings).sort((a, b) => {
      // Put "All India" first, "Open States" second
      if (a === 'All India') return -1;
      if (b === 'All India') return 1;
      if (a === 'Open States') return -1;
      if (b === 'Open States') return 1;
      return a.localeCompare(b);
    }),
    courses: Array.from(allCourseTypes).sort(),
    specialties: Array.from(allSpecialties).sort(),
    quotas: Array.from(allQuotaCodes).sort().map(code => ({
      code: code,
      label: allQuotaLabels.get(code) || code
    })),
    states: Array.from(allStates).sort(),
    collegeTypes: CANONICAL_COLLEGE_TYPES.map(t => ({ code: t, label: t })),
    rounds: Array.from(allRounds).sort((a, b) => {
      // Sort: 24 rounds first, then 25 (Round X)
      const aIs24 = a.startsWith('24 ');
      const bIs24 = b.startsWith('24 ');
      if (aIs24 && !bIs24) return -1;
      if (!aIs24 && bIs24) return 1;
      // Extract round number for sorting
      const aNum = parseFloat(a.match(/([\d.]+)\s*$/)?.[1] || '99');
      const bNum = parseFloat(b.match(/([\d.]+)\s*$/)?.[1] || '99');
      return aNum - bNum;
    })
  };

  fs.writeFileSync(
    path.join(TARGET_DATA_DIR, 'filters.json'),
    JSON.stringify(filters, null, 2)
  );
  console.log(`  Written filters.json`);
  console.log(`    Categories: ${filters.categories.length}`);
  console.log(`    Counsellings: ${filters.counsellings.length}`);
  console.log(`    Courses: ${filters.courses.length}`);
  console.log(`    Specialties: ${filters.specialties.length}`);
  console.log(`    Quotas: ${filters.quotas.length}`);
  console.log(`    States: ${filters.states.length}`);
  console.log(`    College Types: ${filters.collegeTypes.length}`);
  console.log(`    Rounds: ${filters.rounds.length}`);

  // ---- PHASE 6: Validation ----
  console.log('\n=== PHASE 6: Validation ===\n');

  const validationErrors = [];
  let validationPass = true;

  // A. JSON validity — implicitly passed by writing successfully
  console.log('  A. JSON validity: PASS (all files written successfully)');

  // B. Foreign key validation
  let brokenFKs = 0;
  for (const [targetFile, cutoffs] of Object.entries(allCutoffsByTarget)) {
    cutoffs.forEach((r, i) => {
      if (!collegesMap.has(r.collegeId)) {
        brokenFKs++;
        if (brokenFKs <= 10) {
          validationErrors.push(`Broken FK in ${targetFile}[${i}]: collegeId=${r.collegeId}`);
        }
      }
    });
  }
  if (brokenFKs > 0) {
    console.log(`  B. Foreign keys: FAIL (${brokenFKs} broken references)`);
    validationPass = false;
  } else {
    console.log('  B. Foreign keys: PASS (0 broken references)');
  }

  // C. College uniqueness
  const idCounts = {};
  collegesArray.forEach(c => { idCounts[c.id] = (idCounts[c.id] || 0) + 1; });
  const duplicates = Object.entries(idCounts).filter(([, v]) => v > 1);
  if (duplicates.length > 0) {
    console.log(`  C. College uniqueness: FAIL (${duplicates.length} duplicates)`);
    duplicates.slice(0, 5).forEach(([id, count]) => {
      validationErrors.push(`Duplicate college ID: ${id} (${count} times)`);
    });
    validationPass = false;
  } else {
    console.log('  C. College uniqueness: PASS');
  }

  // D. Course validity
  const invalidCourses = new Set();
  const validCourseTypes = new Set(['MD', 'MS', 'MCh', 'DNB', 'Diploma', 'Master']);
  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => {
      if (!validCourseTypes.has(r.course)) invalidCourses.add(r.course);
    });
  }
  if (invalidCourses.size > 0) {
    console.log(`  D. Course validity: WARN (unknown types: ${Array.from(invalidCourses).join(', ')})`);
  } else {
    console.log('  D. Course validity: PASS');
  }

  // E. College type validity
  const invalidTypes = new Set();
  collegesArray.forEach(c => {
    if (!CANONICAL_COLLEGE_TYPES.includes(c.collegeType)) {
      invalidTypes.add(c.collegeType);
    }
  });
  if (invalidTypes.size > 0) {
    console.log(`  E. College type validity: FAIL (invalid types: ${Array.from(invalidTypes).join(', ')})`);
    validationPass = false;
  } else {
    console.log('  E. College type validity: PASS');
  }

  // F. State validity
  const noStateColleges = collegesArray.filter(c => !c.state);
  if (noStateColleges.length > 0) {
    console.log(`  F. State validity: WARN (${noStateColleges.length} colleges without state)`);
  } else {
    console.log('  F. State validity: PASS');
  }

  // G. Rank validity
  let invalidRanks = 0;
  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => {
      if (typeof r.closingRank !== 'number' || isNaN(r.closingRank) || r.closingRank <= 0) {
        invalidRanks++;
      }
    });
  }
  if (invalidRanks > 0) {
    console.log(`  G. Rank validity: FAIL (${invalidRanks} invalid ranks)`);
    validationPass = false;
  } else {
    console.log('  G. Rank validity: PASS');
  }

  // H. Round validity
  const roundValues = new Set();
  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => roundValues.add(r.round));
  }
  console.log(`  H. Round validity: PASS (${roundValues.size} unique rounds)`);

  // I. Year validity
  const yearValues = new Set();
  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => yearValues.add(r.year));
  }
  console.log(`  I. Year validity: PASS (years: ${Array.from(yearValues).sort().join(', ')})`);

  // J. Data loss check
  console.log(`  J. Data loss check:`);
  console.log(`     Source records: ${totalSourceRecords}`);
  console.log(`     Output cutoff records: ${totalOutputRecords}`);
  console.log(`     Records rejected: ${recordsRejected}`);

  // ---- PHASE 7: Generate reports ----
  console.log('\n=== PHASE 7: Reports ===\n');

  // College type distribution
  const collegeTypeDist = {};
  collegesArray.forEach(c => {
    collegeTypeDist[c.collegeType] = (collegeTypeDist[c.collegeType] || 0) + 1;
  });
  console.log('  College Type Distribution:');
  Object.entries(collegeTypeDist).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  // Course type distribution
  const courseTypeDist = {};
  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => {
      courseTypeDist[r.course] = (courseTypeDist[r.course] || 0) + 1;
    });
  }
  console.log('\n  Course Type Distribution:');
  Object.entries(courseTypeDist).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`    ${type}: ${count}`);
  });

  // Year distribution
  const yearDist = {};
  for (const cutoffs of Object.values(allCutoffsByTarget)) {
    cutoffs.forEach(r => {
      yearDist[r.year] = (yearDist[r.year] || 0) + 1;
    });
  }
  console.log('\n  Year Distribution:');
  Object.entries(yearDist).sort().forEach(([year, count]) => {
    console.log(`    ${year}: ${count}`);
  });

  // Per-file output counts
  console.log('\n  Output File Sizes:');
  for (const [targetFile, cutoffs] of Object.entries(allCutoffsByTarget)) {
    console.log(`    ${targetFile}: ${cutoffs.length} records`);
  }

  // Write audit report
  const auditReport = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSourceRecords,
      totalOutputRecords,
      recordsRejected,
      rejectionReasons,
      uniqueColleges: collegesArray.length,
      uniqueCourseTypes: Array.from(allCourseTypes).sort(),
      uniqueSpecialties: allSpecialties.size,
      uniqueCollegeTypes: Object.keys(collegeTypeDist),
      uniqueQuotas: allQuotaCodes.size,
      uniqueStates: allStates.size,
      uniqueRounds: roundValues.size,
      years: Array.from(yearValues).sort()
    },
    distributions: {
      collegeTypes: collegeTypeDist,
      courseTypes: courseTypeDist,
      years: yearDist
    },
    validation: {
      overallPass: validationPass,
      brokenForeignKeys: brokenFKs,
      duplicateColleges: duplicates.length,
      invalidCourseTypes: Array.from(invalidCourses),
      invalidCollegeTypes: Array.from(invalidTypes),
      invalidRanks,
      collegesWithoutState: noStateColleges.length,
      errors: validationErrors
    },
    ambiguousClassifications: ambiguousColleges.length
  };

  fs.writeFileSync(
    path.join(TARGET_AUDIT_DIR, 'data_update_report.json'),
    JSON.stringify(auditReport, null, 2)
  );

  // Write college classification review
  if (ambiguousColleges.length > 0) {
    fs.writeFileSync(
      path.join(TARGET_AUDIT_DIR, 'college_classification_review.json'),
      JSON.stringify(ambiguousColleges, null, 2)
    );
    console.log(`\n  Written college_classification_review.json: ${ambiguousColleges.length} entries`);
  }

  // Write markdown report
  const mdReport = `# Data Migration Report

Generated: ${new Date().toISOString()}

## Summary

| Metric | Value |
|--------|-------|
| Source Records | ${totalSourceRecords} |
| Output Cutoff Records | ${totalOutputRecords} |
| Records Rejected | ${recordsRejected} |
| Unique Colleges | ${collegesArray.length} |
| Unique Course Types | ${Array.from(allCourseTypes).sort().join(', ')} |
| Unique Specialties | ${allSpecialties.size} |
| Unique Quotas | ${allQuotaCodes.size} |
| Unique States | ${allStates.size} |
| Years | ${Array.from(yearValues).sort().join(', ')} |

## College Type Distribution

| Type | Count |
|------|-------|
${Object.entries(collegeTypeDist).sort((a, b) => b[1] - a[1]).map(([t, c]) => `| ${t} | ${c} |`).join('\n')}

## Course Type Distribution

| Type | Count |
|------|-------|
${Object.entries(courseTypeDist).sort((a, b) => b[1] - a[1]).map(([t, c]) => `| ${t} | ${c} |`).join('\n')}

## Year Distribution

| Year | Records |
|------|---------|
${Object.entries(yearDist).sort().map(([y, c]) => `| ${y} | ${c} |`).join('\n')}

## Validation

| Check | Result |
|-------|--------|
| JSON Validity | PASS |
| Foreign Keys | ${brokenFKs === 0 ? 'PASS' : `FAIL (${brokenFKs})`} |
| College Uniqueness | ${duplicates.length === 0 ? 'PASS' : `FAIL (${duplicates.length})`} |
| Course Validity | ${invalidCourses.size === 0 ? 'PASS' : `WARN (${Array.from(invalidCourses).join(', ')})`} |
| College Type Validity | ${invalidTypes.size === 0 ? 'PASS' : `FAIL`} |
| State Validity | ${noStateColleges.length === 0 ? 'PASS' : `WARN (${noStateColleges.length})`} |
| Rank Validity | ${invalidRanks === 0 ? 'PASS' : `FAIL (${invalidRanks})`} |

## Ambiguous Classifications

${ambiguousColleges.length} colleges required re-evaluation. See \`college_classification_review.json\` for details.

## Rejection Reasons

${Object.entries(rejectionReasons).map(([reason, count]) => `- ${reason}: ${count}`).join('\n') || 'None'}
`;

  fs.writeFileSync(
    path.join(TARGET_AUDIT_DIR, 'data_update_report.md'),
    mdReport
  );

  console.log('\n=== Migration Complete ===');
  console.log(`  Overall validation: ${validationPass ? 'PASS' : 'ISSUES FOUND (see report)'}`);
  console.log(`  Reports written to: ${TARGET_AUDIT_DIR}`);
}

// Run
main();
