// =====================================================================
// SINGLE SOURCE OF TRUTH FOR BUSINESS IDENTITY.
// All identity fields below are confirmed. Nothing here may be invented, and
// any future addition must be verifiable before it ships.
// =====================================================================
export const business = {
  companyName:       'Mazidi Group',
  legalName:         'Mazidi Homes Limited',
  companyNumber:     '15350516',
  ownerName:         'Aimal Mazidi',
  email:             'support@mazidigroup.com',
  phone:             '07985 276060',
  domain:            'mazidigroup.com',
  registeredAddress: 'Flat 55 Banstead Court, 60 Westway, London W12 0QJ',
  serviceArea:       'West London and surrounding areas, within 30 miles',
  servicePostcode:   'W12 0QJ',
  hours:             'Monday to Friday, 9:00am to 5:30pm',
  icoRegistration:   'C1996539'
};

export const pricing = {
  // Indicative only. Never presented as a fixed quotation.
  installFrom:  1495,
  monitoring:   39,
  currency:     '£'
};

export const product = {
  name: 'Business Backup Box',
  promise:
    'Automated local backups for your office computers, with version history, ' +
    'a tested recovery route, monitoring and an optional offsite copy.'
};
