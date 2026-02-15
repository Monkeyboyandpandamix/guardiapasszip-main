
export interface PasswordEntry {
  id: string;
  name: string;
  url: string;
  username: string;
  password?: string;
  category: 'Personal' | 'Work' | 'Financial' | 'Other';
  lastModified: number;
  isEncrypted: boolean;
  ownerEmail?: string;
  securityAnalysis?: {
    score: number;
    feedback: string;
    vulnerabilities: string[];
  };
}

export interface GroundingLink {
  uri: string;
  title: string;
}

export interface VerificationResult {
  isSafe: boolean;
  threatLevel: 'Low' | 'Medium' | 'High';
  summary: string;
  details: string[];
  sources?: GroundingLink[];
  certificateInfo?: {
    issuer: string;
    validUntil: string;
    isTrusted: boolean;
    protocol: string;
  };
}

export interface AddressSuggestion {
  address: string;
  sources?: GroundingLink[];
}

export interface IdentityEntry {
  id: string;
  label: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface HiddenPhotoEntry {
  id: string;
  name: string;
  mimeType: string;
  encryptedData: string;
  createdAt: number;
}

export interface VisitRecord {
  id: string;
  url: string;
  timestamp: number;
  isThreat?: boolean;
}

export enum AppSection {
  Vault = 'vault',
  Verifier = 'verifier',
  BreachScanner = 'breach',
  Analytics = 'analytics',
  AIAdvisor = 'advisor',
  Education = 'education',
  Download = 'download',
  Settings = 'settings',
  Network = 'network'
}

export interface PageContent {
  title: string;
  text: string;
  url: string;
  description?: string;
  headings?: string[];
}

export interface SessionState {
  isLocked: boolean;
  userEmail: string | null;
  lastActive: number;
}
