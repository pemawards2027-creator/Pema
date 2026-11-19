export type NominationStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Submitted'
  | 'Under Evaluation'
  | 'Qualified'
  | 'Awardee Confirmed'
  | 'Not Selected';

export interface SimulatedEmailNotification {
  id: string;
  nominationId: string;
  referenceCode: string;
  recipientName: string;
  recipientEmail: string;
  previousStatus: NominationStatus;
  newStatus: 'Approved' | 'Rejected';
  subject: string;
  body: string;
  sentAt: string;
  deliveryStatus: 'Simulated & Delivered';
}

export interface HeadlineTemplateConfig {
  kicker: string;
  headline: string;
  subheadline: string;
  ctaLabel: string;
  ctaPath: string;
  updatedAt: string;
}

export interface HighlightOfTheMonthConfig {
  monthLabel: string;
  title: string;
  honoreeName: string;
  category: string;
  summary: string;
  impactNote: string;
  ctaLabel: string;
  ctaPath: string;
  updatedAt: string;
}

export interface CertificateTemplateConfig {
  templateName: string;
  uploadedImageUrl: string | null;
  preserveDesignAsIs: boolean;
  showEditableOverlay: boolean;
  defaultAwardeeName: string;
  defaultAwardTitle: string;
  defaultProfession: string;
  defaultCitationLine: string;
  defaultDateLabel: string;
  defaultSignatoryLine: string;
  updatedAt: string;
}

export interface OrganizationSettings {
  contactNumber: string;
  contactEmail: string;
  officeLocation: string;
  ceremonySchedule: string;
  customLogoUrl: string | null;
  organizationNote: string;
  pricingTiers: PricingTier[];
  headlineTemplate: HeadlineTemplateConfig;
  highlightOfTheMonth: HighlightOfTheMonthConfig;
  certificateTemplate?: CertificateTemplateConfig;
}

export type PaymentStatus =
  | 'Pending Confirmation'
  | 'Pending Payment'
  | 'Receipt Uploaded'
  | 'Partial'
  | 'Paid / Verified'
  | 'Waived';

export interface UploadedFileRef {
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
  uploadedAt: string;
}

export interface UserPasskeyCredential {
  id: string;
  userId: string;
  credentialId: string;
  publicKeyB64: string;
  counter: number;
  transports: string[];
  deviceLabel: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface PublicPasskeyDevice {
  id: string;
  deviceLabel: string;
  deviceType: string;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  createdAt: string;
  hasPasskey?: boolean;
  passkeyCount?: number;
}

export interface NominationRecord {
  id: string;
  referenceCode: string;
  userId: string | null;
  completeName: string;
  phoneNumber: string;
  emailAddress: string;
  currentAge: number;
  completeAddress: string;
  currentWorkProfession: string;
  cvWillFollow: boolean;
  cvFile: UploadedFileRef | null;
  majorProjects: string;
  supportingDocs: UploadedFileRef[];
  status: NominationStatus;
  committeeNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  receiptReference: string;
  nominationId: string | null;
  userId: string | null;
  payerName: string;
  payerEmail: string;
  payerPhone: string;
  description: string;
  amountDue: number;
  amountPaid: number;
  currency: 'PHP';
  paymentMethod: string;
  paymentDate: string;
  status: PaymentStatus;
  userProofFile: UploadedFileRef | null;
  officialReceiptFile: UploadedFileRef | null;
  adminRemarks: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'New' | 'Reviewed' | 'Responded';
}

export interface PricingTier {
  id: string;
  name: string;
  audience: string;
  priceLabel: string;
  amountPhp: number | null;
  statusNote: string;
  inclusions: string[];
}

export interface FaqItem {
  number: string;
  question: string;
  answer: string;
}

export interface AwardeeGalleryItem {
  id: string;
  awardeeName: string;
  awardTitle: string;
  profession: string;
  era: 'New Awardee' | 'Past Awardee';
  yearLabel: string;
  photoFile: UploadedFileRef | null;
  photoUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegitimacyCredential {
  id: string;
  title: string;
  issuingAuthority: string;
  registrationNumber: string;
  details: string;
  status: 'Pending Review' | 'Internal Verified';
  attachmentFile: UploadedFileRef | null;
  createdAt: string;
  updatedAt: string;
}

export type ChatSenderRole = 'customer' | 'admin' | 'ai';

export interface ChatMessage {
  id: string;
  senderRole: ChatSenderRole;
  senderDisplayName: string;
  text: string;
  attachments: UploadedFileRef[];
  sentAt: string;
}

export interface ChatThread {
  id: string;
  ticketNumber: string;
  userId: string;
  userAccountName: string;
  userEmail: string;
  customerName: string;
  contactNumber: string;
  inquiryReason: string;
  status: 'Queued' | 'Active' | 'Resolved';
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminRevisionEntry {
  id: string;
  label: string;
  adminName: string;
  createdAt: string;
}

export interface LiveWebsiteContent {
  sourceUrl: string;
  lastSyncedAt: string;
  liveSyncOk: boolean;
  syncStatusMessage: string;
  hero: {
    eyebrow: string;
    headlinePrefix: string;
    headlineEmphasis: string;
    subtitle: string;
  };
  about: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
  };
  services: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    items: Array<{ number: string; title: string; description: string }>;
  };
  pricing: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    confirmChecklist: string;
  };
  gallery: {
    eyebrow: string;
    title: string;
    subtitle: string;
  };
  faq: {
    eyebrow: string;
    titlePrefix: string;
    titleEmphasis: string;
    items: FaqItem[];
  };
  contact: {
    eyebrow: string;
    titlePrefix: string;
    titleEmphasis: string;
    subtitle: string;
    responseNote: string;
  };
  settings: OrganizationSettings;
  awardees: AwardeeGalleryItem[];
  supportAvailable: boolean;
}

export type EvaluatorSlot = 'evaluator_1' | 'evaluator_2' | 'evaluator_3' | 'evaluator_4';

export type DepartmentAccessRole =
  | 'funding'
  | 'finance'
  | 'committee'
  | EvaluatorSlot;

export type AdminDepartmentRole = 'executive' | DepartmentAccessRole;

export interface CriteriaScoreBreakdown {
  achievements: number; // max 25
  communityImpact: number; // max 25
  leadership: number; // max 20
  integrity: number; // max 15
  innovation: number; // max 10
  supportingDocs: number; // max 5
}

export type EvaluatorRecommendation =
  | 'Recommend Approval'
  | 'For Board Deliberation'
  | 'Not Recommended';

export interface NominationEvaluationScore {
  id: string;
  nominationId: string;
  evaluatorSlot: EvaluatorSlot;
  evaluatorLabel: string;
  evaluatorName: string;
  criteriaScores: CriteriaScoreBreakdown;
  totalScore: number;
  recommendation: EvaluatorRecommendation;
  remarks: string;
  updatedAt: string;
}

export type ProjectFundingType =
  | 'Ceremony Sponsorship'
  | 'Institutional Grant'
  | 'Patronage Fund'
  | 'Production Allocation';

export type ProjectFundingStatus =
  | 'Proposed'
  | 'Active Pledge'
  | 'Partially Disbursed'
  | 'Fully Funded'
  | 'Closed';

export interface ProjectFundingRecord {
  id: string;
  programCode: string;
  title: string;
  sourceOrSponsor: string;
  fundingType: ProjectFundingType;
  targetAmountPhp: number;
  committedAmountPhp: number;
  disbursedAmountPhp: number;
  financeClearanceStatus: 'Pending Finance Review' | 'Finance Verified';
  status: ProjectFundingStatus;
  notes: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentRoleMeta {
  role: AdminDepartmentRole;
  title: string;
  shortLabel: string;
  unitGroup: string;
  summary: string;
  responsibilities: string[];
  allowedTabs: string[];
}

