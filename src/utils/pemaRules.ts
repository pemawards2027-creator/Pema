import type { NominationRecord, PaymentRecord } from '../types/pema';

export interface NominationFormInput {
  completeName: string;
  phoneNumber: string;
  emailAddress: string;
  currentAge: string | number;
  completeAddress: string;
  currentWorkProfession: string;
  cvWillFollow?: boolean;
  hasCvFile?: boolean;
  majorProjects?: string;
}

export const NOMINATION_FIELD_LIMITS = {
  completeName: { min: 2, max: 120 },
  phoneNumber: { minDigits: 7, maxDigits: 15, max: 25 },
  emailAddress: { max: 120 },
  currentAge: { min: 10, max: 120 },
  completeAddress: { min: 5, max: 300 },
  currentWorkProfession: { min: 2, max: 120 },
  majorProjects: { max: 1500 },
} as const;

export interface ValidationErrors {
  completeName?: string;
  phoneNumber?: string;
  emailAddress?: string;
  currentAge?: string;
  completeAddress?: string;
  currentWorkProfession?: string;
  majorProjects?: string;
}

export interface NominationValidationResult {
  valid: boolean;
  errors: ValidationErrors;
  parsedAge: number | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNominationForm(input: NominationFormInput): NominationValidationResult {
  const errors: ValidationErrors = {};

  const name = (input.completeName ?? '').trim();
  if (name.length < NOMINATION_FIELD_LIMITS.completeName.min) {
    errors.completeName = `Please enter your complete name (at least ${NOMINATION_FIELD_LIMITS.completeName.min} characters).`;
  } else if (name.length > NOMINATION_FIELD_LIMITS.completeName.max) {
    errors.completeName = `Complete name must be ${NOMINATION_FIELD_LIMITS.completeName.max} characters or fewer.`;
  }

  const phoneRaw = (input.phoneNumber ?? '').trim();
  const phoneDigits = phoneRaw.replace(/\D/g, '');
  if (
    phoneDigits.length < NOMINATION_FIELD_LIMITS.phoneNumber.minDigits ||
    phoneDigits.length > NOMINATION_FIELD_LIMITS.phoneNumber.maxDigits ||
    phoneRaw.length > NOMINATION_FIELD_LIMITS.phoneNumber.max
  ) {
    errors.phoneNumber = 'Please enter a valid contact phone number (7–15 digits).';
  }

  const email = (input.emailAddress ?? '').trim();
  if (!EMAIL_REGEX.test(email)) {
    errors.emailAddress = 'Please enter a valid email address.';
  } else if (email.length > NOMINATION_FIELD_LIMITS.emailAddress.max) {
    errors.emailAddress = `Email address must be ${NOMINATION_FIELD_LIMITS.emailAddress.max} characters or fewer.`;
  }

  const ageRaw = String(input.currentAge ?? '').trim();
  const ageNum = typeof input.currentAge === 'number' ? input.currentAge : ageRaw ? Number(ageRaw) : NaN;
  const validAge =
    Number.isInteger(ageNum) &&
    ageNum >= NOMINATION_FIELD_LIMITS.currentAge.min &&
    ageNum <= NOMINATION_FIELD_LIMITS.currentAge.max;
  if (!validAge) {
    errors.currentAge = `Please enter a valid current age (whole number between ${NOMINATION_FIELD_LIMITS.currentAge.min} and ${NOMINATION_FIELD_LIMITS.currentAge.max}).`;
  }

  const address = (input.completeAddress ?? '').trim();
  if (address.length < NOMINATION_FIELD_LIMITS.completeAddress.min) {
    errors.completeAddress = `Please enter your complete residential or office address (at least ${NOMINATION_FIELD_LIMITS.completeAddress.min} characters).`;
  } else if (address.length > NOMINATION_FIELD_LIMITS.completeAddress.max) {
    errors.completeAddress = `Complete address must be ${NOMINATION_FIELD_LIMITS.completeAddress.max} characters or fewer.`;
  }

  const work = (input.currentWorkProfession ?? '').trim();
  if (work.length < NOMINATION_FIELD_LIMITS.currentWorkProfession.min) {
    errors.currentWorkProfession = `Please enter your current work or profession (at least ${NOMINATION_FIELD_LIMITS.currentWorkProfession.min} characters).`;
  } else if (work.length > NOMINATION_FIELD_LIMITS.currentWorkProfession.max) {
    errors.currentWorkProfession = `Current work / profession must be ${NOMINATION_FIELD_LIMITS.currentWorkProfession.max} characters or fewer.`;
  }

  const projects = (input.majorProjects ?? '').trim();
  if (projects.length > NOMINATION_FIELD_LIMITS.majorProjects.max) {
    errors.majorProjects = `Major projects & initiatives must be ${NOMINATION_FIELD_LIMITS.majorProjects.max} characters or fewer.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    parsedAge: validAge ? ageNum : null,
  };
}

export function countMandatoryFieldsValid(input: NominationFormInput): {
  validCount: number;
  totalCount: number;
  ready: boolean;
} {
  const { errors } = validateNominationForm(input);
  const mandatoryKeys: Array<keyof ValidationErrors> = [
    'completeName',
    'phoneNumber',
    'emailAddress',
    'currentAge',
    'completeAddress',
    'currentWorkProfession',
  ];
  const validCount = mandatoryKeys.filter((k) => !errors[k]).length;
  return {
    validCount,
    totalCount: mandatoryKeys.length,
    ready: validCount === mandatoryKeys.length && !errors.majorProjects,
  };
}

export interface ChatIntakeInput {
  customerName: string;
  contactNumber: string;
  inquiryReason: string;
  attachmentCount?: number;
}

export interface ChatIntakeValidationResult {
  valid: boolean;
  errors: {
    customerName?: string;
    contactNumber?: string;
    inquiryReason?: string;
    attachments?: string;
  };
}

export const MIN_CHAT_INQUIRY_CHARS = 10;
export const MAX_CHAT_INQUIRY_CHARS = 200;
export const MAX_CHAT_ATTACHMENTS = 2;

export function validateChatIntake(input: ChatIntakeInput): ChatIntakeValidationResult {
  const errors: ChatIntakeValidationResult['errors'] = {};

  const name = (input.customerName ?? '').trim();
  if (name.length < 2) {
    errors.customerName = 'Please enter your complete name.';
  }

  const phoneDigits = (input.contactNumber ?? '').replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.contactNumber = 'Please enter an active contact number (7–15 digits).';
  }

  const reason = (input.inquiryReason ?? '').trim();
  if (reason.length < MIN_CHAT_INQUIRY_CHARS) {
    errors.inquiryReason = `Please describe your reason or inquiry in at least ${MIN_CHAT_INQUIRY_CHARS} characters (currently ${reason.length}).`;
  } else if (reason.length > MAX_CHAT_INQUIRY_CHARS) {
    errors.inquiryReason = `Please keep your reason or inquiry within ${MAX_CHAT_INQUIRY_CHARS} characters (currently ${reason.length}).`;
  }

  if ((input.attachmentCount ?? 0) > MAX_CHAT_ATTACHMENTS) {
    errors.attachments = `You can attach up to ${MAX_CHAT_ATTACHMENTS} files or photos maximum.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

const AUTHORIZED_ADMIN_NAMES = ['princess', 'jreal'] as const;

export function normalizeAuthorizedAdminName(rawName: string): 'Princess' | 'Jreal' | null {
  const cleaned = (rawName ?? '').trim().toLowerCase();
  if (!AUTHORIZED_ADMIN_NAMES.includes(cleaned as (typeof AUTHORIZED_ADMIN_NAMES)[number])) {
    return null;
  }
  return cleaned === 'princess' ? 'Princess' : 'Jreal';
}

export interface PaymentSummary {
  totalRecords: number;
  totalBilledPhp: number;
  totalPaidPhp: number;
  outstandingPhp: number;
  verifiedCount: number;
  pendingCount: number;
  receiptCount: number;
}

export function computePaymentSummary(payments: PaymentRecord[]): PaymentSummary {
  let totalBilledPhp = 0;
  let totalPaidPhp = 0;
  let verifiedCount = 0;
  let pendingCount = 0;
  let receiptCount = 0;

  for (const p of payments) {
    const due = Number.isFinite(p.amountDue) ? Math.max(0, p.amountDue) : 0;
    const paid = Number.isFinite(p.amountPaid) ? Math.max(0, p.amountPaid) : 0;
    totalBilledPhp += due;
    totalPaidPhp += paid;

    if (p.status === 'Paid / Verified' || p.status === 'Waived') {
      verifiedCount += 1;
    } else {
      pendingCount += 1;
    }

    if (p.officialReceiptFile) {
      receiptCount += 1;
    }
  }

  const outstandingPhp = Math.max(0, totalBilledPhp - totalPaidPhp);

  return {
    totalRecords: payments.length,
    totalBilledPhp,
    totalPaidPhp,
    outstandingPhp,
    verifiedCount,
    pendingCount,
    receiptCount,
  };
}

export function formatPhpCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'To be confirmed';
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function generateReferenceCode(prefix: string, sequenceNumber: number, year = 2027): string {
  const padded = String(Math.max(1, sequenceNumber)).padStart(4, '0');
  return `${prefix}-${year}-${padded}`;
}

export interface ParsedBundleSnippet {
  about?: string[];
  services?: string[];
  pricing?: string[];
  faqQuestions?: string[];
}

export function parseLiveBundleContent(bundleJs: string): ParsedBundleSnippet {
  const result: ParsedBundleSnippet = {};
  if (!bundleJs || typeof bundleJs !== 'string') {
    return result;
  }

  // Extract pageCopy = { about: [...], services: [...], pricing: [...] }
  const pageCopyMatch = bundleJs.match(/const\s+pageCopy\s*=\s*\{([\s\S]*?)\};/);
  if (pageCopyMatch) {
    const block = pageCopyMatch[1];
    for (const key of ['about', 'services', 'pricing'] as const) {
      const arrMatch = block.match(new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
      if (arrMatch) {
        const items: string[] = [];
        const strRegex = /"((?:[^"\\]|\\.)*)"/g;
        let m: RegExpExecArray | null;
        while ((m = strRegex.exec(arrMatch[1])) !== null) {
          try {
            items.push(JSON.parse(`"${m[1]}"`));
          } catch {
            items.push(m[1]);
          }
        }
        if (items.length > 0) {
          result[key] = items;
        }
      }
    }
  }

  // Extract faqs = ["...", "..."]
  const faqMatch = bundleJs.match(/const\s+faqs\s*=\s*\[([\s\S]*?)\];/);
  if (faqMatch) {
    const questions: string[] = [];
    const strRegex = /"((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = strRegex.exec(faqMatch[1])) !== null) {
      try {
        questions.push(JSON.parse(`"${m[1]}"`));
      } catch {
        questions.push(m[1]);
      }
    }
    if (questions.length > 0) {
      result.faqQuestions = questions;
    }
  }

  return result;
}

export function buildNominationStatusEmail(params: {
  recipientName: string;
  referenceCode: string;
  newStatus: 'Approved' | 'Rejected';
  committeeNotes?: string;
  contactNumber?: string;
  contactEmail?: string;
}): { subject: string; body: string } {
  const {
    recipientName,
    referenceCode,
    newStatus,
    committeeNotes = '',
    contactNumber = '0924-173-7587',
    contactEmail = 'pem.awards2027@gmail.com',
  } = params;

  if (newStatus === 'Approved') {
    return {
      subject: `[PEMA] Official Notice: Nomination Approved (${referenceCode})`,
      body: [
        `Dear ${recipientName},`,
        '',
        `Congratulations! Following thorough evaluation by the Philippine Excellency and Merit Awards (PEMA) Screening Committee, your nomination (${referenceCode}) has been officially APPROVED.`,
        '',
        committeeNotes ? `Committee Remarks: ${committeeNotes}` : '',
        'Next Steps:',
        '• Sign in to your PEMA Member Account to review your qualification status and official fee confirmation.',
        '• If you selected "CV / PDS to follow once qualified", please upload your complete Curriculum Vitae or Personal Data Sheet in your account portal.',
        '',
        `For coordination, contact the PEMA Secretariat at ${contactNumber} or ${contactEmail}.`,
        '',
        'With distinction,',
        'Philippine Excellency and Merit Awards (PEMA) Secretariat',
      ]
        .filter((line) => line !== null && line !== undefined)
        .join('\n')
        .replace(/\n{3,}/g, '\n\n'),
    };
  }

  return {
    subject: `[PEMA] Official Notice: Nomination Evaluation Update (${referenceCode})`,
    body: [
      `Dear ${recipientName},`,
      '',
      `Thank you for submitting your nomination (${referenceCode}) to the Philippine Excellency and Merit Awards (PEMA).`,
      '',
      'After careful deliberation based on our established evaluation criteria and supporting documentation, we regret to inform you that your nomination has NOT been selected for advancement in this cycle (Status: Rejected).',
      '',
      committeeNotes ? `Committee Remarks: ${committeeNotes}` : '',
      'We deeply appreciate your contributions to Filipino excellence and encourage you to reach out if you would like feedback or wish to submit updated accomplishments in a future season.',
      '',
      `For inquiries, please contact the PEMA Secretariat at ${contactNumber} or ${contactEmail}.`,
      '',
      'Respectfully,',
      'Philippine Excellency and Merit Awards (PEMA) Secretariat',
    ]
      .filter((line) => line !== null && line !== undefined)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n'),
  };
}

export interface EvaluationCriterion {
  number: number;
  title: string;
  weightPercent: number;
  description: string;
}

export const NOMINATION_EVALUATION_CRITERIA: EvaluationCriterion[] = [
  {
    number: 1,
    title: 'Outstanding Achievements and Accomplishments',
    weightPercent: 25,
    description:
      'Significant professional achievements, awards, recognitions, and measurable results.',
  },
  {
    number: 2,
    title: 'Community Contribution and Social Impact',
    weightPercent: 25,
    description:
      "Meaningful contributions to the community, beneficiaries, or the nominee's field of service.",
  },
  {
    number: 3,
    title: 'Leadership and Initiative',
    weightPercent: 20,
    description:
      'Demonstrated leadership, successful projects, programs, initiatives, and positive influence.',
  },
  {
    number: 4,
    title: 'Integrity and Professional Ethics',
    weightPercent: 15,
    description:
      'Good moral character, accountability, professionalism, and ethical conduct.',
  },
  {
    number: 5,
    title: 'Innovation and Excellence',
    weightPercent: 10,
    description:
      "Creative solutions, improvements, and initiatives that demonstrate excellence in the nominee's field.",
  },
  {
    number: 6,
    title: 'Supporting Documents and Verifiable Records',
    weightPercent: 5,
    description:
      'Availability of certificates, portfolio, commendations, photographs, published features, or other relevant evidence.',
  },
];

export interface NominationCategoryCluster {
  id: string;
  clusterTitle: string;
  awards: string[];
}

export const NOMINATION_CATEGORY_CLUSTERS: NominationCategoryCluster[] = [
  {
    id: 'education-academic',
    clusterTitle: 'EDUCATION AND ACADEMIC EXCELLENCE',
    awards: [
      'Outstanding Educator and Academic Excellence Award',
      'Excellence in Educational Leadership Award',
      'Outstanding Research and Innovation Award',
    ],
  },
  {
    id: 'public-service',
    clusterTitle: 'PUBLIC SERVICE AND GOVERNANCE',
    awards: [
      'Outstanding Public Servant Award',
      'Excellence in Local Governance and Community Leadership Award',
      'Distinguished Public Service and Leadership Award',
    ],
  },
  {
    id: 'community-social',
    clusterTitle: 'COMMUNITY SERVICE AND SOCIAL ADVOCACY',
    awards: [
      'Outstanding Community Service Award',
      'Excellence in Humanitarian Service and Social Advocacy Award',
      'Outstanding Volunteerism and Civic Engagement Award',
    ],
  },
  {
    id: 'business-entrepreneurship',
    clusterTitle: 'BUSINESS AND ENTREPRENEURSHIP',
    awards: [
      'Outstanding Entrepreneur of the Year Award',
      'Excellence in Business Leadership and Innovation Award',
      'Outstanding Small Business and Enterprise Development Award',
    ],
  },
  {
    id: 'healthcare-medical',
    clusterTitle: 'HEALTHCARE AND MEDICAL SERVICE',
    awards: [
      'Outstanding Healthcare Professional Award',
      'Excellence in Medical Service and Patient Care Award',
      'Outstanding Public Health Advocacy Award',
    ],
  },
  {
    id: 'arts-culture-media',
    clusterTitle: 'ARTS, CULTURE, ENTERTAINMENT, AND MEDIA',
    awards: [
      'Outstanding Achievement in Arts and Entertainment Award',
      'Excellence in Journalism and Media Communication Award',
      'Outstanding Cultural Preservation and Creative Excellence Award',
    ],
  },
  {
    id: 'environment-sustainability',
    clusterTitle: 'ENVIRONMENTAL ADVOCACY AND SUSTAINABLE DEVELOPMENT',
    awards: [
      'Outstanding Environmental Stewardship Award',
      'Excellence in Environmental Advocacy and Conservation Award',
      'Outstanding Sustainable Development Initiative Award',
    ],
  },
  {
    id: 'leadership-innovation',
    clusterTitle: 'LEADERSHIP, PROFESSIONAL EXCELLENCE, AND INNOVATION',
    awards: [
      'Outstanding Professional of the Year Award',
      'Excellence in Leadership and Organizational Development Award',
      'Outstanding Achievement in Innovation and Nation-Building Award',
    ],
  },
];

export function filterNominations(
  nominations: NominationRecord[],
  query: string,
  statusFilter = 'ALL',
): NominationRecord[] {
  const q = (query ?? '').trim().toLowerCase();
  const normalizedStatus = (statusFilter ?? 'ALL').trim();

  return nominations.filter((nom) => {
    const matchesStatus = normalizedStatus === 'ALL' || nom.status === normalizedStatus;
    if (!matchesStatus) return false;
    if (!q) return true;

    return (
      nom.completeName.toLowerCase().includes(q) ||
      nom.emailAddress.toLowerCase().includes(q) ||
      nom.status.toLowerCase().includes(q) ||
      nom.referenceCode.toLowerCase().includes(q) ||
      nom.currentWorkProfession.toLowerCase().includes(q)
    );
  });
}

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportNominationsToCsv(nominations: NominationRecord[]): string {
  const headers = [
    'Reference Code',
    'Complete Name',
    'Email Address',
    'Phone Number',
    'Current Age',
    'Complete Address',
    'Current Work / Profession',
    'CV / PDS Status',
    'Major Projects / Advocacy',
    'Supporting Files Count',
    'Status',
    'Committee Notes',
    'Submitted At',
    'Last Updated',
  ];

  const rows = nominations.map((nom) => [
    nom.referenceCode,
    nom.completeName,
    nom.emailAddress,
    nom.phoneNumber,
    nom.currentAge,
    nom.completeAddress,
    nom.currentWorkProfession,
    nom.cvFile ? nom.cvFile.fileName : nom.cvWillFollow ? 'To follow once qualified' : 'Not attached',
    nom.majorProjects,
    nom.supportingDocs?.length ?? 0,
    nom.status,
    nom.committeeNotes,
    nom.createdAt,
    nom.updatedAt,
  ]);

  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return `\uFEFF${lines.join('\r\n')}`;
}

export const EVALUATOR_SLOTS = [
  'evaluator_1',
  'evaluator_2',
  'evaluator_3',
  'evaluator_4',
] as const;

export const DEPARTMENT_ROLE_CATALOG: Record<
  import('../types/pema').AdminDepartmentRole,
  import('../types/pema').DepartmentRoleMeta
> = {
  executive: {
    role: 'executive',
    title: 'Executive Secretariat Console',
    shortLabel: 'Executive Admin',
    unitGroup: 'Executive Secretariat',
    summary:
      'Unrestricted oversight across all PEMA operations, Finance, Project Funding, Committee on Board, Gallery, Certificates, Support, and Department Access Control.',
    responsibilities: [
      'Full access to all operational tabs and system revisions (Undo / Revert)',
      'Manage authorized department access passcodes and audit all modules',
      'Publish live website headline, highlight, logo, gallery, and certificates',
    ],
    allowedTabs: [
      'payments',
      'nominations',
      'board',
      'funding',
      'certificates',
      'emails',
      'gallery',
      'chat',
      'credentials',
      'departments',
      'editorial',
      'settings',
      'inquiries',
    ],
  },
  funding: {
    role: 'funding',
    title: 'PEMA Project Funding Department',
    shortLabel: 'Project Funding Dept',
    unitGroup: 'Funding & Sponsorships',
    summary:
      'Manages institutional grants, ceremony sponsorships, patronage pledges, production fund allocations, and budget milestones.',
    responsibilities: [
      'Create, update, and track project funding initiatives, sponsors, and PHP targets',
      'Monitor committed vs. disbursed project allocations for PEMA events',
      'Submit funding records for Official Finance treasury clearance (no OR issuance)',
    ],
    allowedTabs: ['funding', 'payments'],
  },
  finance: {
    role: 'finance',
    title: 'PEMA Official Finance Department',
    shortLabel: 'Official Finance Dept',
    unitGroup: 'Treasury & Official Receipts',
    summary:
      'Sole treasury authority for payment monitoring, verifying member deposit proofs, issuing Official Receipts (OR), and clearing funding disbursements.',
    responsibilities: [
      'Record billing, verify bank/payment proofs, and upload Official Receipts',
      'Verify and grant Finance Clearance on Project Funding disbursements',
      'Reconcile collected vs. outstanding PHP balances (cannot alter nominations or gallery)',
    ],
    allowedTabs: ['payments', 'funding'],
  },
  committee: {
    role: 'committee',
    title: 'Committee on Board',
    shortLabel: 'Committee on Board',
    unitGroup: 'Governing Board & Screening',
    summary:
      'Reviews consolidated 4-Evaluator rubric scores, deliberates final qualification, approves/rejects nominations, manages award certificates, and dispatches status notices.',
    responsibilities: [
      'Review consolidated scores from Evaluators 1–4 across the 100% PEMA criteria',
      'Issue final Board decisions (Approved / Rejected / Qualified / Awardee Confirmed)',
      'Manage Award Certificate templates, simulated status emails, and Nomination CSV/PDF exports',
    ],
    allowedTabs: ['board', 'nominations', 'certificates', 'emails'],
  },
  evaluator_1: {
    role: 'evaluator_1',
    title: 'Committee on Board — Evaluator 1',
    shortLabel: 'Evaluator 1',
    unitGroup: 'Evaluation Panel (Slot 1 of 4)',
    summary:
      'Independent Evaluation Panel Seat 1. Evaluates nominee dossiers, CV/PDS, and supporting records against the 6 weighted PEMA Criteria (Total 100%).',
    responsibilities: [
      'Inspect nominee dossiers, accomplishments, CV/PDS, and supporting proof files',
      'Score each nominee across all 6 PEMA Criteria (25%+25%+20%+15%+10%+5% = 100%)',
      'Submit Evaluator 1 recommendation & remarks to the Committee on Board (isolated from Finance/Funding)',
    ],
    allowedTabs: ['board'],
  },
  evaluator_2: {
    role: 'evaluator_2',
    title: 'Committee on Board — Evaluator 2',
    shortLabel: 'Evaluator 2',
    unitGroup: 'Evaluation Panel (Slot 2 of 4)',
    summary:
      'Independent Evaluation Panel Seat 2. Evaluates nominee dossiers, CV/PDS, and supporting records against the 6 weighted PEMA Criteria (Total 100%).',
    responsibilities: [
      'Inspect nominee dossiers, accomplishments, CV/PDS, and supporting proof files',
      'Score each nominee across all 6 PEMA Criteria (25%+25%+20%+15%+10%+5% = 100%)',
      'Submit Evaluator 2 recommendation & remarks to the Committee on Board (isolated from Finance/Funding)',
    ],
    allowedTabs: ['board'],
  },
  evaluator_3: {
    role: 'evaluator_3',
    title: 'Committee on Board — Evaluator 3',
    shortLabel: 'Evaluator 3',
    unitGroup: 'Evaluation Panel (Slot 3 of 4)',
    summary:
      'Independent Evaluation Panel Seat 3. Evaluates nominee dossiers, CV/PDS, and supporting records against the 6 weighted PEMA Criteria (Total 100%).',
    responsibilities: [
      'Inspect nominee dossiers, accomplishments, CV/PDS, and supporting proof files',
      'Score each nominee across all 6 PEMA Criteria (25%+25%+20%+15%+10%+5% = 100%)',
      'Submit Evaluator 3 recommendation & remarks to the Committee on Board (isolated from Finance/Funding)',
    ],
    allowedTabs: ['board'],
  },
  evaluator_4: {
    role: 'evaluator_4',
    title: 'Committee on Board — Evaluator 4',
    shortLabel: 'Evaluator 4',
    unitGroup: 'Evaluation Panel (Slot 4 of 4)',
    summary:
      'Independent Evaluation Panel Seat 4. Evaluates nominee dossiers, CV/PDS, and supporting records against the 6 weighted PEMA Criteria (Total 100%).',
    responsibilities: [
      'Inspect nominee dossiers, accomplishments, CV/PDS, and supporting proof files',
      'Score each nominee across all 6 PEMA Criteria (25%+25%+20%+15%+10%+5% = 100%)',
      'Submit Evaluator 4 recommendation & remarks to the Committee on Board (isolated from Finance/Funding)',
    ],
    allowedTabs: ['board'],
  },
};

export function isEvaluatorRole(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
): role is import('../types/pema').EvaluatorSlot {
  return (
    role === 'evaluator_1' ||
    role === 'evaluator_2' ||
    role === 'evaluator_3' ||
    role === 'evaluator_4'
  );
}

export function isValidDepartmentAccessRole(
  raw: string,
): raw is import('../types/pema').DepartmentAccessRole {
  return (
    raw === 'funding' ||
    raw === 'finance' ||
    raw === 'committee' ||
    raw === 'evaluator_1' ||
    raw === 'evaluator_2' ||
    raw === 'evaluator_3' ||
    raw === 'evaluator_4'
  );
}

export function getAllowedTabsForRole(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
): string[] {
  if (!role || !(role in DEPARTMENT_ROLE_CATALOG)) {
    return [];
  }
  return DEPARTMENT_ROLE_CATALOG[role].allowedTabs;
}

export function canRoleMutatePayments(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
): boolean {
  return role === 'executive' || role === 'finance';
}

export function canRoleMutateFunding(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
): boolean {
  return role === 'executive' || role === 'funding';
}

export function canRoleClearFundingFinance(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
): boolean {
  return role === 'executive' || role === 'finance';
}

export function canRoleDecideNomination(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
): boolean {
  return role === 'executive' || role === 'committee';
}

export function canRoleScoreEvaluatorSlot(
  role: import('../types/pema').AdminDepartmentRole | null | undefined,
  targetSlot: import('../types/pema').EvaluatorSlot,
): boolean {
  if (role === 'executive') return true;
  if (isEvaluatorRole(role)) return role === targetSlot;
  return false;
}

export function normalizeCriteriaScores(
  raw: Partial<import('../types/pema').CriteriaScoreBreakdown>,
): {
  breakdown: import('../types/pema').CriteriaScoreBreakdown;
  totalScore: number;
} {
  const clamp = (val: unknown, max: number) => {
    const n = Number(val ?? 0);
    if (!Number.isFinite(n)) return 0;
    return Math.round(Math.min(max, Math.max(0, n)) * 10) / 10;
  };
  const breakdown: import('../types/pema').CriteriaScoreBreakdown = {
    achievements: clamp(raw.achievements, 25),
    communityImpact: clamp(raw.communityImpact, 25),
    leadership: clamp(raw.leadership, 20),
    integrity: clamp(raw.integrity, 15),
    innovation: clamp(raw.innovation, 10),
    supportingDocs: clamp(raw.supportingDocs, 5),
  };
  const totalScore =
    Math.round(
      (breakdown.achievements +
        breakdown.communityImpact +
        breakdown.leadership +
        breakdown.integrity +
        breakdown.innovation +
        breakdown.supportingDocs) *
        10,
    ) / 10;
  return { breakdown, totalScore };
}

export function computeBoardConsensus(
  evaluations: import('../types/pema').NominationEvaluationScore[],
): {
  submittedCount: number;
  averageScore: number | null;
  recommendApprovalCount: number;
  forDeliberationCount: number;
  notRecommendedCount: number;
} {
  if (!evaluations.length) {
    return {
      submittedCount: 0,
      averageScore: null,
      recommendApprovalCount: 0,
      forDeliberationCount: 0,
      notRecommendedCount: 0,
    };
  }
  let sum = 0;
  let recommendApprovalCount = 0;
  let forDeliberationCount = 0;
  let notRecommendedCount = 0;
  for (const ev of evaluations) {
    sum += Number.isFinite(ev.totalScore) ? ev.totalScore : 0;
    if (ev.recommendation === 'Recommend Approval') recommendApprovalCount += 1;
    else if (ev.recommendation === 'For Board Deliberation') forDeliberationCount += 1;
    else notRecommendedCount += 1;
  }
  return {
    submittedCount: evaluations.length,
    averageScore: Math.round((sum / evaluations.length) * 10) / 10,
    recommendApprovalCount,
    forDeliberationCount,
    notRecommendedCount,
  };
}

export function computeFundingSummary(
  records: import('../types/pema').ProjectFundingRecord[],
): {
  totalInitiatives: number;
  totalTargetPhp: number;
  totalCommittedPhp: number;
  totalDisbursedPhp: number;
  remainingToTargetPhp: number;
  financeVerifiedCount: number;
} {
  let totalTargetPhp = 0;
  let totalCommittedPhp = 0;
  let totalDisbursedPhp = 0;
  let financeVerifiedCount = 0;

  for (const r of records) {
    totalTargetPhp += Number.isFinite(r.targetAmountPhp) ? Math.max(0, r.targetAmountPhp) : 0;
    totalCommittedPhp += Number.isFinite(r.committedAmountPhp)
      ? Math.max(0, r.committedAmountPhp)
      : 0;
    totalDisbursedPhp += Number.isFinite(r.disbursedAmountPhp)
      ? Math.max(0, r.disbursedAmountPhp)
      : 0;
    if (r.financeClearanceStatus === 'Finance Verified') financeVerifiedCount += 1;
  }

  return {
    totalInitiatives: records.length,
    totalTargetPhp,
    totalCommittedPhp,
    totalDisbursedPhp,
    remainingToTargetPhp: Math.max(0, totalTargetPhp - totalCommittedPhp),
    financeVerifiedCount,
  };
}


