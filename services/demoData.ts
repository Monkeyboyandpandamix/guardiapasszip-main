import { PasswordEntry, IdentityEntry, VisitRecord, VerificationResult } from '../types';
import { BreachResult, PasswordBreachResult } from './breachService';
import { HunterVerificationResult } from './hunterService';

const now = Date.now();
const hours = (h: number) => now - h * 3600000;
const days = (d: number) => now - d * 86400000;

export const DEMO_PASSWORDS: PasswordEntry[] = [
  {
    id: 'demo-pw-001',
    name: 'Google Workspace',
    url: 'accounts.google.com',
    username: 'sarah.chen@gmail.com',
    password: 'U2FsdGVkX1+vuppp...encrypted_demo',
    category: 'Work',
    lastModified: hours(2),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 94, feedback: 'Excellent password strength. Uses mixed case, numbers, symbols, and is 18 characters long. No dictionary words detected.', vulnerabilities: [] },
  },
  {
    id: 'demo-pw-002',
    name: 'GitHub Enterprise',
    url: 'github.com',
    username: 'sarah-chen-dev',
    password: 'U2FsdGVkX1+abc123...encrypted_demo',
    category: 'Work',
    lastModified: hours(5),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 87, feedback: 'Strong password with good entropy. Consider adding more special characters for maximum security.', vulnerabilities: ['Could benefit from additional symbols'] },
  },
  {
    id: 'demo-pw-003',
    name: 'Chase Bank',
    url: 'chase.com',
    username: 'sarah.chen.banking',
    password: 'U2FsdGVkX1+def456...encrypted_demo',
    category: 'Financial',
    lastModified: days(1),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 96, feedback: 'Maximum security rating. 24-character passphrase with high entropy. Unique to this account.', vulnerabilities: [] },
  },
  {
    id: 'demo-pw-004',
    name: 'Netflix',
    url: 'netflix.com',
    username: 'sarah.chen@gmail.com',
    password: 'U2FsdGVkX1+ghi789...encrypted_demo',
    category: 'Personal',
    lastModified: days(3),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 72, feedback: 'Moderate strength. Password is 12 characters but uses a common pattern. Consider regenerating with AI.', vulnerabilities: ['Common substitution pattern detected', 'Used on another service'] },
  },
  {
    id: 'demo-pw-005',
    name: 'AWS Console',
    url: 'aws.amazon.com',
    username: 'sarah.chen@company.io',
    password: 'U2FsdGVkX1+jkl012...encrypted_demo',
    category: 'Work',
    lastModified: days(2),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 91, feedback: 'Strong password with MFA enabled. Good practice for cloud infrastructure access.', vulnerabilities: [] },
  },
  {
    id: 'demo-pw-006',
    name: 'Spotify Premium',
    url: 'spotify.com',
    username: 'sarahchen_music',
    password: 'U2FsdGVkX1+mno345...encrypted_demo',
    category: 'Personal',
    lastModified: days(7),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
  },
  {
    id: 'demo-pw-007',
    name: 'Slack',
    url: 'slack.com',
    username: 'sarah.chen@company.io',
    password: 'U2FsdGVkX1+pqr678...encrypted_demo',
    category: 'Work',
    lastModified: days(1),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 88, feedback: 'Strong passphrase-style password. Good length and complexity.', vulnerabilities: [] },
  },
  {
    id: 'demo-pw-008',
    name: 'PayPal',
    url: 'paypal.com',
    username: 'sarah.chen@gmail.com',
    password: 'U2FsdGVkX1+stu901...encrypted_demo',
    category: 'Financial',
    lastModified: days(5),
    isEncrypted: true,
    ownerEmail: 'sarah.chen@gmail.com',
    securityAnalysis: { score: 82, feedback: 'Good password. Meets all PayPal security requirements. Consider enabling 2FA for additional protection.', vulnerabilities: ['2FA not confirmed'] },
  },
];

export const DEMO_IDENTITIES: IdentityEntry[] = [
  {
    id: 'demo-id-001',
    label: 'Primary Identity',
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@gmail.com',
    phone: '+1 (415) 555-0142',
    address: '1455 Market Street',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94103',
    country: 'United States',
  },
  {
    id: 'demo-id-002',
    label: 'Work Profile',
    firstName: 'Sarah',
    lastName: 'Chen',
    email: 'sarah.chen@company.io',
    phone: '+1 (415) 555-0198',
    address: '525 Brannan Street',
    city: 'San Francisco',
    state: 'CA',
    zipCode: '94107',
    country: 'United States',
  },
];

export const DEMO_VISITS: VisitRecord[] = [
  { id: 'demo-v-001', url: 'https://mail.google.com/inbox', timestamp: hours(0.1), isThreat: false },
  { id: 'demo-v-002', url: 'https://github.com/sarah-chen-dev/guardiapass', timestamp: hours(0.3), isThreat: false },
  { id: 'demo-v-003', url: 'https://g00gle-login.security-verify.tk', timestamp: hours(0.5), isThreat: true },
  { id: 'demo-v-004', url: 'https://docs.google.com/spreadsheets/d/1abc', timestamp: hours(0.8), isThreat: false },
  { id: 'demo-v-005', url: 'https://stackoverflow.com/questions/react-hooks', timestamp: hours(1.2), isThreat: false },
  { id: 'demo-v-006', url: 'https://chase-account-verify.com/login', timestamp: hours(1.5), isThreat: true },
  { id: 'demo-v-007', url: 'https://netflix.com/browse', timestamp: hours(2), isThreat: false },
  { id: 'demo-v-008', url: 'https://aws.amazon.com/console', timestamp: hours(2.5), isThreat: false },
  { id: 'demo-v-009', url: 'https://slack.com/client/T024BE7LD', timestamp: hours(3), isThreat: false },
  { id: 'demo-v-010', url: 'https://app1e-id-verify.support-login.xyz', timestamp: hours(3.5), isThreat: true },
  { id: 'demo-v-011', url: 'https://linkedin.com/feed', timestamp: hours(4), isThreat: false },
  { id: 'demo-v-012', url: 'https://figma.com/file/design-system', timestamp: hours(5), isThreat: false },
  { id: 'demo-v-013', url: 'https://notion.so/workspace/sprint-planning', timestamp: hours(6), isThreat: false },
  { id: 'demo-v-014', url: 'https://paypa1-secure.account-update.buzz', timestamp: hours(7), isThreat: true },
  { id: 'demo-v-015', url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', timestamp: hours(8), isThreat: false },
  { id: 'demo-v-016', url: 'https://calendar.google.com/r/week', timestamp: days(1), isThreat: false },
  { id: 'demo-v-017', url: 'https://vercel.com/dashboard', timestamp: days(1) + hours(3), isThreat: false },
  { id: 'demo-v-018', url: 'https://npmjs.com/package/react', timestamp: days(1) + hours(5), isThreat: false },
  { id: 'demo-v-019', url: 'https://amazon.com/orders', timestamp: days(2), isThreat: false },
  { id: 'demo-v-020', url: 'https://reddit.com/r/cybersecurity', timestamp: days(2) + hours(2), isThreat: false },
  { id: 'demo-v-021', url: 'https://twitter.com/home', timestamp: days(2) + hours(6), isThreat: false },
  { id: 'demo-v-022', url: 'https://microsft-teams-login.tk/auth', timestamp: days(3), isThreat: true },
  { id: 'demo-v-023', url: 'https://drive.google.com/drive/my-drive', timestamp: days(3) + hours(2), isThreat: false },
  { id: 'demo-v-024', url: 'https://medium.com/security-weekly', timestamp: days(3) + hours(8), isThreat: false },
  { id: 'demo-v-025', url: 'https://spotify.com/playlist/discover-weekly', timestamp: days(4), isThreat: false },
  { id: 'demo-v-026', url: 'https://zoom.us/j/meeting-standup', timestamp: days(4) + hours(1), isThreat: false },
  { id: 'demo-v-027', url: 'https://jira.atlassian.net/browse/GP-142', timestamp: days(4) + hours(4), isThreat: false },
  { id: 'demo-v-028', url: 'https://dropbox.com/home', timestamp: days(5), isThreat: false },
  { id: 'demo-v-029', url: 'https://stripe.com/dashboard', timestamp: days(5) + hours(3), isThreat: false },
  { id: 'demo-v-030', url: 'https://amaz0n-refund.claim-center.ml', timestamp: days(5) + hours(7), isThreat: true },
  { id: 'demo-v-031', url: 'https://codepen.io/trending', timestamp: days(6), isThreat: false },
  { id: 'demo-v-032', url: 'https://dev.to/security-best-practices', timestamp: days(6) + hours(4), isThreat: false },
];

export const DEMO_VERIFIER_RESULTS: Record<string, VerificationResult> = {
  'g00gle-login.security-verify.tk': {
    isSafe: false,
    threatLevel: 'High',
    summary: 'CRITICAL PHISHING THREAT DETECTED. This domain uses homoglyph substitution ("g00gle" replacing "o" with "0") combined with a deceptive subdomain structure to impersonate Google. The .tk TLD is heavily associated with phishing campaigns. Do NOT enter any credentials.',
    details: [
      'HOMOGLYPH ATTACK: "g00gle" uses numeric zero (0) in place of the letter "o" to mimic "google.com"',
      'DECEPTIVE SUBDOMAIN: "security-verify" is a social engineering keyword designed to create false urgency',
      'MALICIOUS TLD: .tk domains are free and frequently used in phishing operations — 94% of .tk domains are malicious',
      'NO VALID SSL: Certificate is self-signed and not issued by a recognized Certificate Authority',
      'BRAND IMPERSONATION: Targets Google — legitimate domain is google.com',
      'WHOIS PRIVACY: Domain registered anonymously 3 days ago — classic disposable phishing infrastructure',
    ],
    certificateInfo: { issuer: 'Self-Signed', validUntil: 'N/A', isTrusted: false, protocol: 'SUSPECT' },
  },
  'google.com': {
    isSafe: true,
    threatLevel: 'Low',
    summary: 'google.com is the verified, legitimate domain for Google LLC. No indicators of phishing, typosquatting, or brand impersonation detected. This is a trusted, globally recognized domain.',
    details: [
      'TYPOSQUATTING CHECK: Domain exactly matches the known brand "google". No character substitution or homoglyphs detected.',
      'SSL CERTIFICATE: Valid EV certificate issued by Google Trust Services LLC, expires 2026-08-15',
      'WHOIS VERIFICATION: Registered to Google LLC since 1997. Domain age: 29 years — highly established.',
      'REPUTATION: Listed in Alexa Top 3 globally. Zero phishing reports in any major threat intelligence database.',
      'DNS SECURITY: DNSSEC enabled. All DNS records consistent with legitimate Google infrastructure.',
    ],
    certificateInfo: { issuer: 'Google Trust Services LLC', validUntil: '2026-08-15', isTrusted: true, protocol: 'TLS 1.3' },
  },
  'chase-account-verify.com': {
    isSafe: false,
    threatLevel: 'High',
    summary: 'HIGH-RISK PHISHING SITE impersonating Chase Bank (JPMorgan Chase). The domain uses the "chase" brand name with authentication keywords designed to steal banking credentials. The legitimate Chase banking domain is chase.com.',
    details: [
      'BRAND IMPERSONATION: Contains "chase" with the modifier "account-verify" — a classic credential harvesting pattern',
      'NOT LEGITIMATE: chase.com is the only official Chase banking domain. This site has no affiliation with JPMorgan Chase.',
      'FINANCIAL TARGETING: Banking phishing sites are the most dangerous — they directly target financial credentials and personal data',
      'RECENTLY REGISTERED: Domain created 48 hours ago via an anonymous registrar in Eastern Europe',
      'FAKE LOGIN PAGE: Page mimics Chase.com login portal with copied CSS and imagery',
    ],
    certificateInfo: { issuer: "Let's Encrypt", validUntil: '2026-05-20', isTrusted: false, protocol: 'TLS 1.2' },
  },
};

export const DEMO_BREACH_EMAIL_RESULTS: Record<string, BreachResult> = {
  'sarah.chen@gmail.com': {
    found: true,
    count: 2,
    breaches: [
      {
        name: 'LinkedIn 2021 Data Scrape',
        date: 'June 2021',
        description: 'In June 2021, approximately 700 million LinkedIn user records were scraped and posted for sale. The exposed data included email addresses, full names, phone numbers, physical addresses, geolocation records, and professional details. While passwords were not included, the dataset enabled targeted phishing and social engineering attacks.',
      },
      {
        name: 'Adobe 2013 Breach',
        date: 'October 2013',
        description: 'Adobe suffered a massive breach affecting 153 million user records. Exposed data included internal IDs, usernames, emails, encrypted passwords (using weak 3DES encryption), and password hints. Many passwords were subsequently cracked due to the weak encryption method used.',
      },
    ],
    summary: 'This email address was found in 2 known data breaches. The LinkedIn scrape exposed profile data that could be used for targeted phishing, and the Adobe breach exposed encrypted credentials. We recommend enabling 2FA on all accounts associated with this email and monitoring for suspicious login attempts.',
  },
  'test@example.com': {
    found: true,
    count: 5,
    breaches: [
      { name: 'Collection #1 Mega Breach', date: 'January 2019', description: 'A massive collection of 773 million email addresses and 21 million unique passwords aggregated from numerous smaller breaches and credential stuffing lists. This was one of the largest collections of breached data ever discovered.' },
      { name: 'Dropbox 2012 Breach', date: 'August 2012', description: 'Dropbox disclosed a breach affecting 68 million users. Bcrypt-hashed passwords and email addresses were exposed when an employee reused a password from LinkedIn.' },
      { name: 'MyFitnessPal 2018 Breach', date: 'February 2018', description: 'Under Armour reported that approximately 150 million MyFitnessPal user accounts were compromised. Exposed data included usernames, email addresses, and SHA-1 hashed passwords.' },
      { name: 'Canva 2019 Breach', date: 'May 2019', description: 'Canva suffered a breach impacting 137 million users. Data exposed included usernames, real names, email addresses, and bcrypt-hashed passwords.' },
      { name: 'Zynga 2019 Breach', date: 'September 2019', description: 'A hacker accessed 218 million Words With Friends player accounts, exposing email addresses, usernames, login IDs, hashed passwords (SHA-1 with salt), phone numbers, and Facebook IDs.' },
    ],
    summary: 'This email has significant exposure across 5 major data breaches spanning 2012-2019. Credentials associated with this email have likely been compiled into credential stuffing databases. Immediate action recommended: change all passwords, enable 2FA everywhere, and monitor financial accounts.',
  },
};

export const DEMO_BREACH_USERNAME_RESULTS: Record<string, BreachResult> = {
  'sarah-chen-dev': {
    found: true,
    count: 1,
    breaches: [
      {
        name: 'GitHub Gist Credential Exposure',
        date: 'March 2022',
        description: 'Automated scanners detected this username in publicly accessible GitHub Gists containing configuration files with embedded credentials. While not a platform breach, this represents accidental credential exposure through code repositories.',
      },
    ],
    summary: 'This username was found in 1 credential exposure incident. A configuration file containing this username was found in a public GitHub Gist. We recommend rotating any credentials that may have been included in public code repositories and enabling GitHub secret scanning.',
  },
};

export const DEMO_BREACH_PASSWORD_RESULTS: Record<string, PasswordBreachResult> = {
  'password123': { found: true, count: 12487291 },
  'admin123': { found: true, count: 52256179 },
  'qwerty': { found: true, count: 4730510 },
};

export const DEMO_HUNTER_RESULTS: Record<string, HunterVerificationResult> = {
  'sarah.chen@gmail.com': {
    email: 'sarah.chen@gmail.com',
    status: 'valid',
    score: 95,
    disposable: false,
    gibberish: false,
    webmail: true,
    mx_records: true,
    smtp_server: true,
    smtp_check: true,
    accept_all: false,
    block: false,
  },
  'sarah.chen@company.io': {
    email: 'sarah.chen@company.io',
    status: 'valid',
    score: 91,
    disposable: false,
    gibberish: false,
    webmail: false,
    mx_records: true,
    smtp_server: true,
    smtp_check: true,
    accept_all: false,
    block: false,
  },
  'phisher@malicious-domain.tk': {
    email: 'phisher@malicious-domain.tk',
    status: 'invalid',
    score: 8,
    disposable: true,
    gibberish: true,
    webmail: false,
    mx_records: false,
    smtp_server: false,
    smtp_check: false,
    accept_all: false,
    block: true,
  },
};

export const DEMO_PASSWORD_ANALYSIS = {
  score: 94,
  feedback: 'Excellent password strength. Uses a 22-character passphrase with mixed case, numbers, and special characters. No dictionary words or common patterns detected. Estimated crack time: 4.7 billion years.',
  vulnerabilities: [] as string[],
};

export const DEMO_GENERATED_PASSPHRASE = 'Qu4ntum$h13ld_N3ur0n!';
