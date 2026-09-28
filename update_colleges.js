const fs = require('fs');
const path = require('path');

const datfileDir = '/Users/swethshaw/career plan b/datfile';
const collegesFile = '/Users/swethshaw/career plan b/college_pre/data/colleges.json';

const stateCodes = {
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
  "Madhya Pradesh": "MP",
  "Maharashtra": "MH",
  "Manipur": "MN",
  "Meghalaya": "ML",
  "Mizoram": "MZ",
  "Nagaland": "NL",
  "Odisha": "OR",
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

function generateId(state, name) {
  let code = stateCodes[state] || 'XX';
  let cleanName = name.replace(/&/g, 'and');
  cleanName = cleanName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').toUpperCase();
  cleanName = cleanName.replace(/^_/, '').replace(/_$/, '');
  return `${code}_${cleanName}`;
}

let existingColleges = JSON.parse(fs.readFileSync(collegesFile, 'utf8'));
let collegesMap = new Map();
existingColleges.forEach(c => collegesMap.set(c.id, c));

let files = fs.readdirSync(datfileDir).filter(f => f.endsWith('.json'));

let updatedTypesCount = 0;

for (let file of files) {
  let filepath = path.join(datfileDir, file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (e) {
    continue;
  }
  
  if (!Array.isArray(data)) continue;

  for (let row of data) {
    if (!row.institute || !row.institute.name) continue;

    let state = row.state || 'All India';
    let name = row.institute.name;
    let id = generateId(state, name);

    let isPrivate = false;
    let isGovt = false;
    let isDnb = false;
    let isDeemed = false;
    let isCentral = false;

    let qName = (row.quota && row.quota.name) ? row.quota.name.toLowerCase() : '';
    let masterQ = (row.quota && row.quota.master_quota) ? row.quota.master_quota.toLowerCase() : '';
    let cName = (row.counselling && row.counselling.name) ? row.counselling.name.toLowerCase() : '';
    let iName = name.toLowerCase();

    // Check DEEMED
    if (qName.includes('deemed') || masterQ.includes('deemed') || cName.includes('deemed') || iName.includes('deemed')) {
      isDeemed = true;
    }
    // Check CENTRAL
    else if (qName.includes('central') || masterQ.includes('central') || cName.includes('central') || iName.includes('central')) {
      isCentral = true;
    }
    // Check PRIVATE
    else if (qName.includes('priv') || masterQ.includes('priv') || cName.includes('private') || iName.includes('private') || qName.includes('management') || masterQ.includes('management')) {
      isPrivate = true;
    }
    // Check DNB
    else if (qName.includes('dnb') || masterQ.includes('dnb')) {
      isDnb = true;
    }
    // Check GOVT
    else if (qName.includes('govt') || qName.includes('government') || masterQ.includes('govt') || masterQ.includes('government') || cName.includes('govt') || iName.includes('government')) {
      isGovt = true;
    }

    let inferredType = null;
    if (isDeemed) inferredType = "Deemed University";
    else if (isCentral) inferredType = "Central University";
    else if (isDnb) inferredType = "DNB Hospital";
    else if (isPrivate) inferredType = "Private";
    else if (isGovt) inferredType = "Government";

    if (!collegesMap.has(id)) {
      collegesMap.set(id, {
        id: id,
        name: name,
        city: row.institute.district || "",
        state: state,
        collegeType: inferredType || "Government"
      });
    } else {
      let col = collegesMap.get(id);
      if (inferredType && col.collegeType !== inferredType) {
        if (inferredType === 'Deemed University' || inferredType === 'Central University' || inferredType === 'DNB Hospital' || inferredType === 'Private') {
           col.collegeType = inferredType;
           updatedTypesCount++;
        }
      }
    }
  }
}

console.log('Colleges type updated:', updatedTypesCount);

let finalColleges = Array.from(collegesMap.values());
fs.writeFileSync(collegesFile, JSON.stringify(finalColleges, null, 2));
console.log('Saved colleges.json with', finalColleges.length, 'records.');
