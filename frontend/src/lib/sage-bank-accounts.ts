// Sage checking-account IDs per Hub site.
export const SITE_BANK_ACCOUNTS: Record<string, string> = {
  Rankin: 'Rankin Gen7 LP SB',
  Couchiching: '72',
  Walpole: '75',
  Sarnia: '74',
  'Jocko Point': '77',
  'Silver Grizzly': '79',
}

// GL account each site's payroll journal credits (the site's bank account in
// the chart of accounts). Sage's REST checking-account object does not expose
// its GL account, so this can't be looked up — add sites here as needed.
export const SITE_BANK_GL_ACCOUNTS: Record<string, string> = {
  Couchiching: '10131',
  'Jocko Point': '10097',
  Rankin: '10119',
  Sarnia: '10088',
  'Silver Grizzly': '10135',
  Walpole: '10104',
}
