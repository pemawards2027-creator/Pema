import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminDepartmentRole,
  AwardeeGalleryItem,
  ChatThread,
  ContactInquiry,
  DepartmentAccessRole,
  LegitimacyCredential,
  NominationEvaluationScore,
  NominationRecord,
  OrganizationSettings,
  PaymentRecord,
  ProjectFundingRecord,
  SimulatedEmailNotification,
  UploadedFileRef,
  UserAccount,
  UserPasskeyCredential,
} from '../src/types/pema';

export interface StoredUser extends UserAccount {
  passwordHash: string;
}

export interface SessionRecord {
  token: string;
  userId?: string;
  isAdmin?: boolean;
  adminName?: string;
  department?: AdminDepartmentRole;
  createdAt: string;
}

export interface AdminSnapshot {
  nominations: NominationRecord[];
  payments: PaymentRecord[];
  inquiries: ContactInquiry[];
  emailNotifications: SimulatedEmailNotification[];
  settings: OrganizationSettings;
  awardees: AwardeeGalleryItem[];
  legitimacyCredentials: LegitimacyCredential[];
  projectFunding: ProjectFundingRecord[];
  nominationEvaluations: NominationEvaluationScore[];
  lastSequence: number;
}

export interface AdminRevisionRecord {
  id: string;
  label: string;
  adminName: string;
  createdAt: string;
  snapshot: AdminSnapshot;
}

export interface PemaDatabase {
  users: StoredUser[];
  passkeys: UserPasskeyCredential[];
  sessions: SessionRecord[];
  nominations: NominationRecord[];
  payments: PaymentRecord[];
  inquiries: ContactInquiry[];
  emailNotifications: SimulatedEmailNotification[];
  settings: OrganizationSettings;
  awardees: AwardeeGalleryItem[];
  legitimacyCredentials: LegitimacyCredential[];
  projectFunding: ProjectFundingRecord[];
  nominationEvaluations: NominationEvaluationScore[];
  departmentPasscodes: Record<DepartmentAccessRole, string>;
  chatThreads: ChatThread[];
  supportAvailable: boolean;
  adminRevisions: AdminRevisionRecord[];
  lastSequence: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'pema-store.json');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

const DEFAULT_SETTINGS: OrganizationSettings = {
  contactNumber: '0924-173-7587',
  contactEmail: 'pem.awards2027@gmail.com',
  officeLocation: 'Metro Manila, Philippines (Secretariat venue to be confirmed)',
  ceremonySchedule: '2027 Awards Season (Exact Gala Date & Venue to be confirmed)',
  customLogoUrl: null,
  organizationNote:
    'Program fees, official gala venue, and final awarding schedules are subject to formal confirmation by the PEMA Organizing Committee.',
  pricingTiers: [
    {
      id: 'tier-nomination',
      name: 'Nomination Screening & Evaluation',
      audience: 'For individual & organizational nominees',
      priceLabel: 'Fee to be confirmed',
      amountPhp: null,
      statusNote: 'Subject to confirmation by the PEMA Organizing Committee',
      inclusions: [
        'Official PEMA dossier review by the evaluation panel',
        'Verification of credentials, CV/PDS, and advocacy impact',
        'Formal qualification notice upon committee deliberation',
      ],
    },
    {
      id: 'tier-awardee',
      name: 'Awardee Recognition & Gala Package',
      audience: 'For qualified & confirmed PEMA honorees',
      priceLabel: 'Rate to be confirmed',
      amountPhp: null,
      statusNote: 'Published upon committee approval · Inclusions confirmed prior to billing',
      inclusions: [
        'Sculpted PEMA Excellence Trophy & Official Medal of Merit',
        'Framed Certificate of Distinction bearing the PEMA Seal',
        'Gala dinner seating, red-carpet photography & editorial citation',
      ],
    },
    {
      id: 'tier-institutional',
      name: 'Institutional & Corporate Delegation',
      audience: 'For organizations & multi-honoree tables',
      priceLabel: 'Custom · To be confirmed',
      amountPhp: null,
      statusNote: 'Tailored table & sponsorship allocations available upon inquiry',
      inclusions: [
        'Reserved VIP table placement at the PEMA Awards Gala',
        'Organization profile highlight in the commemorative folio',
        'Dedicated secretariat coordination for delegation guests',
      ],
    },
  ],
  headlineTemplate: {
    kicker: 'Official PEMA Bulletin',
    headline: '2027 Philippine Excellency & Merit Awards Nominations Now Open',
    subheadline:
      'Submit individual or institutional dossiers for independent committee evaluation across business, public service, culture, and community impact.',
    ctaLabel: 'Submit Nomination',
    ctaPath: '/nominate',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
  highlightOfTheMonth: {
    monthLabel: 'November 2026 Highlight',
    title: 'Grassroots Healthcare & Rural Innovation Spotlight',
    honoreeName: 'Dr. Elena M. Villanueva · Lingap Bayan Network',
    category: 'Civic Health & Community Impact',
    summary:
      'Recognized for establishing mobile maternal diagnostics across 32 coastal barangays in Luzon, expanding preventive healthcare access to underserved families.',
    impactNote: 'Over 14,500 community consultations delivered through volunteer medical missions.',
    ctaLabel: 'Explore Nominee Stories',
    ctaPath: '/about',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
  certificateTemplate: {
    templateName: 'Official PEMA Award Certificate Template',
    uploadedImageUrl: null,
    preserveDesignAsIs: true,
    showEditableOverlay: true,
    defaultAwardeeName: 'Dr. Elena M. Villanueva',
    defaultAwardTitle: 'Outstanding Public Health Advocacy Award',
    defaultProfession: 'Public Health Director & Rural Clinic Founder',
    defaultCitationLine:
      'In recognition of exemplary excellence, integrity, and measurable service to the Filipino community.',
    defaultDateLabel: 'Awarded in the 2027 PEMA Ceremonial Cycle',
    defaultSignatoryLine: 'Philippine Excellency & Merit Awards Screening Committee',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
};

const DEFAULT_AWARDEES: AwardeeGalleryItem[] = [
  {
    id: 'awd-seed-1',
    awardeeName: 'Dr. Elena M. Villanueva',
    awardTitle: 'Philippine Excellence in Community Public Health',
    profession: 'Public Health Director & Rural Clinic Founder',
    era: 'New Awardee',
    yearLabel: '2026–2027 Honoree',
    photoFile: null,
    photoUrl: '/src/assets/images/gallery_ceremony_stage_1795064556740.jpg',
    createdAt: '2026-11-12T10:00:00.000Z',
    updatedAt: '2026-11-12T10:00:00.000Z',
  },
  {
    id: 'awd-seed-2',
    awardeeName: 'Engr. Roberto S. Bautista',
    awardTitle: 'Lifetime Achievement in Sustainable Infrastructure',
    profession: 'Principal Civil & Renewable Systems Engineer',
    era: 'Past Awardee',
    yearLabel: 'Past Honoree Batch',
    photoFile: null,
    photoUrl: '/src/assets/images/gallery_trophy_clean_1795064576318.jpg',
    createdAt: '2025-10-20T09:00:00.000Z',
    updatedAt: '2025-10-20T09:00:00.000Z',
  },
];

const DEFAULT_DEPARTMENT_PASSCODES: Record<DepartmentAccessRole, string> = {
  funding: process.env.PEMA_FUNDING_PASSCODE || 'PEMA-FUND-2027',
  finance: process.env.PEMA_FINANCE_PASSCODE || 'PEMA-FIN-2027',
  committee: process.env.PEMA_BOARD_PASSCODE || 'PEMA-BOARD-2027',
  evaluator_1: process.env.PEMA_EVAL1_PASSCODE || 'PEMA-EVAL1-2027',
  evaluator_2: process.env.PEMA_EVAL2_PASSCODE || 'PEMA-EVAL2-2027',
  evaluator_3: process.env.PEMA_EVAL3_PASSCODE || 'PEMA-EVAL3-2027',
  evaluator_4: process.env.PEMA_EVAL4_PASSCODE || 'PEMA-EVAL4-2027',
};

const DEFAULT_PROJECT_FUNDING: ProjectFundingRecord[] = [
  {
    id: 'fund-seed-1',
    programCode: 'FUND-2027-0001',
    title: '2027 PEMA Awards Gala Production & Venue Fund',
    sourceOrSponsor: 'PEMA Founding Patronage Allocation',
    fundingType: 'Production Allocation',
    targetAmountPhp: 650000,
    committedAmountPhp: 450000,
    disbursedAmountPhp: 150000,
    financeClearanceStatus: 'Finance Verified',
    status: 'Partially Disbursed',
    notes: 'Covers stage design, live streaming broadcast, and security logistics (venue to be finalized).',
    updatedBy: 'PEMA Project Funding Dept',
    createdAt: '2026-11-08T09:00:00.000Z',
    updatedAt: '2026-11-14T11:30:00.000Z',
  },
  {
    id: 'fund-seed-2',
    programCode: 'FUND-2027-0002',
    title: 'Honoree Trophies, Medallions & Commemorative Folio Fund',
    sourceOrSponsor: 'Bayanihan Institutional Sponsorship Pool',
    fundingType: 'Ceremony Sponsorship',
    targetAmountPhp: 280000,
    committedAmountPhp: 200000,
    disbursedAmountPhp: 0,
    financeClearanceStatus: 'Pending Finance Review',
    status: 'Active Pledge',
    notes: 'Awaiting Finance Department clearance prior to trophy foundry downpayment.',
    updatedBy: 'PEMA Project Funding Dept',
    createdAt: '2026-11-11T14:00:00.000Z',
    updatedAt: '2026-11-16T10:15:00.000Z',
  },
];

const DEFAULT_EVALUATIONS: NominationEvaluationScore[] = [
  {
    id: 'eval-seed-1',
    nominationId: 'nom-seed-1',
    evaluatorSlot: 'evaluator_1',
    evaluatorLabel: 'Evaluator 1',
    evaluatorName: 'Board Evaluator 1',
    criteriaScores: {
      achievements: 23,
      communityImpact: 24,
      leadership: 19,
      integrity: 15,
      innovation: 9,
      supportingDocs: 5,
    },
    totalScore: 95,
    recommendation: 'Recommend Approval',
    remarks: 'Verified 32 coastal barangay clinics with measurable patient outreach records.',
    updatedAt: '2026-11-11T16:10:00.000Z',
  },
  {
    id: 'eval-seed-2',
    nominationId: 'nom-seed-1',
    evaluatorSlot: 'evaluator_2',
    evaluatorLabel: 'Evaluator 2',
    evaluatorName: 'Board Evaluator 2',
    criteriaScores: {
      achievements: 22,
      communityImpact: 24,
      leadership: 18,
      integrity: 14,
      innovation: 9,
      supportingDocs: 5,
    },
    totalScore: 92,
    recommendation: 'Recommend Approval',
    remarks: 'Strong community leadership and consistent ethical standing.',
    updatedAt: '2026-11-11T18:00:00.000Z',
  },
];

function createInitialDb(): PemaDatabase {
  const now = new Date().toISOString();
  const sampleUserId = 'usr-demo-1';

  return {
    users: [
      {
        id: sampleUserId,
        fullName: 'Dr. Elena Villanueva',
        email: 'elena.villanueva@example.ph',
        phoneNumber: '0917-555-0148',
        passwordHash: hashPassword('PemaMember2027'),
        createdAt: '2026-11-05T09:30:00.000Z',
      },
    ],
    passkeys: [],
    sessions: [],
    nominations: [
      {
        id: 'nom-seed-1',
        referenceCode: 'PEMA-2027-0001',
        userId: sampleUserId,
        completeName: 'Dr. Elena M. Villanueva',
        phoneNumber: '0917-555-0148',
        emailAddress: 'elena.villanueva@example.ph',
        currentAge: 44,
        completeAddress: '214 Salcedo Street, Legazpi Village, Makati City, Metro Manila',
        currentWorkProfession: 'Public Health Director & Rural Clinic Founder',
        cvWillFollow: false,
        cvFile: null,
        majorProjects:
          'Founded the Lingap Bayan Mobile Health Network serving 32 coastal barangays in Luzon with maternal care and preventive diagnostics.',
        supportingDocs: [],
        status: 'Approved',
        committeeNotes: 'Credentials verified and approved by the PEMA Health & Civic Impact Panel.',
        createdAt: '2026-11-06T11:15:00.000Z',
        updatedAt: '2026-11-12T14:20:00.000Z',
      },
      {
        id: 'nom-seed-2',
        referenceCode: 'PEMA-2027-0002',
        userId: null,
        completeName: 'Engr. Marco Antonio Reyes',
        phoneNumber: '0928-441-8890',
        emailAddress: 'marco.reyes@example.ph',
        currentAge: 38,
        completeAddress: '88 Gorordo Avenue, Lahug, Cebu City, Cebu 6000',
        currentWorkProfession: 'Renewable Microgrid Systems Engineer',
        cvWillFollow: true,
        cvFile: null,
        majorProjects:
          'Solar microgrid deployment for 14 off-grid island schools across the Visayas.',
        supportingDocs: [],
        status: 'Pending',
        committeeNotes: 'Awaiting committee review; CV/PDS to follow once qualified.',
        createdAt: '2026-11-14T08:45:00.000Z',
        updatedAt: '2026-11-15T16:00:00.000Z',
      },
    ],
    payments: [
      {
        id: 'pay-seed-1',
        receiptReference: 'OR-2027-0001',
        nominationId: 'nom-seed-1',
        userId: sampleUserId,
        payerName: 'Dr. Elena M. Villanueva',
        payerEmail: 'elena.villanueva@example.ph',
        payerPhone: '0917-555-0148',
        description: 'Awardee Recognition Reservation (Provisional Assessment)',
        amountDue: 15000,
        amountPaid: 15000,
        currency: 'PHP',
        paymentMethod: 'Bank Transfer (BPI)',
        paymentDate: '2026-11-12',
        status: 'Paid / Verified',
        userProofFile: null,
        officialReceiptFile: null,
        adminRemarks: 'Provisional gala reservation settled; official committee receipt issued.',
        createdAt: '2026-11-10T09:00:00.000Z',
        updatedAt: '2026-11-12T15:00:00.000Z',
      },
      {
        id: 'pay-seed-2',
        receiptReference: 'OR-2027-0002',
        nominationId: 'nom-seed-2',
        userId: null,
        payerName: 'Engr. Marco Antonio Reyes',
        payerEmail: 'marco.reyes@example.ph',
        payerPhone: '0928-441-8890',
        description: 'Evaluation & Processing Assessment (Subject to Confirmation)',
        amountDue: 0,
        amountPaid: 0,
        currency: 'PHP',
        paymentMethod: 'To be confirmed',
        paymentDate: '',
        status: 'Pending Confirmation',
        userProofFile: null,
        officialReceiptFile: null,
        adminRemarks: 'Awaiting committee fee confirmation after evaluation stage.',
        createdAt: '2026-11-14T08:45:00.000Z',
        updatedAt: now,
      },
    ],
    inquiries: [
      {
        id: 'inq-seed-1',
        name: 'Atty. Rafael Mendoza',
        email: 'rmendoza@example.ph',
        phone: '0919-330-2104',
        subject: 'Corporate Delegation Nomination Inquiry',
        message: 'We would like to nominate two community leaders from Davao City for the 2027 cycle.',
        createdAt: '2026-11-15T10:15:00.000Z',
        status: 'New',
      },
    ],
    emailNotifications: [],
    settings: DEFAULT_SETTINGS,
    awardees: DEFAULT_AWARDEES,
    legitimacyCredentials: [],
    projectFunding: DEFAULT_PROJECT_FUNDING,
    nominationEvaluations: DEFAULT_EVALUATIONS,
    departmentPasscodes: { ...DEFAULT_DEPARTMENT_PASSCODES },
    chatThreads: [],
    supportAvailable: false,
    adminRevisions: [],
    lastSequence: 2,
  };
}

function ensureDirectories() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

export function captureAdminSnapshot(db: PemaDatabase): AdminSnapshot {
  return structuredClone({
    nominations: db.nominations,
    payments: db.payments,
    inquiries: db.inquiries,
    emailNotifications: db.emailNotifications,
    settings: db.settings,
    awardees: db.awardees,
    legitimacyCredentials: db.legitimacyCredentials,
    projectFunding: db.projectFunding,
    nominationEvaluations: db.nominationEvaluations,
    lastSequence: db.lastSequence,
  });
}

export function pushAdminRevision(db: PemaDatabase, label: string, adminName: string): void {
  const entry: AdminRevisionRecord = {
    id: `rev-${crypto.randomUUID().slice(0, 8)}`,
    label,
    adminName,
    createdAt: new Date().toISOString(),
    snapshot: captureAdminSnapshot(db),
  };
  db.adminRevisions.unshift(entry);
  if (db.adminRevisions.length > 25) {
    db.adminRevisions = db.adminRevisions.slice(0, 25);
  }
}

export function popAdminRevision(db: PemaDatabase): AdminRevisionRecord | null {
  const entry = db.adminRevisions.shift();
  if (!entry) return null;
  const snap = structuredClone(entry.snapshot);
  db.nominations = snap.nominations;
  db.payments = snap.payments;
  db.inquiries = snap.inquiries;
  db.emailNotifications = snap.emailNotifications;
  db.settings = snap.settings;
  db.awardees = snap.awardees;
  db.legitimacyCredentials = snap.legitimacyCredentials;
  db.projectFunding = snap.projectFunding ?? DEFAULT_PROJECT_FUNDING;
  db.nominationEvaluations = snap.nominationEvaluations ?? [];
  db.lastSequence = snap.lastSequence;
  return entry;
}

export function loadDb(): PemaDatabase {
  ensureDirectories();
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDb();
    saveDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<PemaDatabase>;
    return {
      users: parsed.users ?? [],
      passkeys: Array.isArray(parsed.passkeys) ? parsed.passkeys : [],
      sessions: parsed.sessions ?? [],
      nominations: parsed.nominations ?? [],
      payments: parsed.payments ?? [],
      inquiries: parsed.inquiries ?? [],
      emailNotifications: parsed.emailNotifications ?? [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        contactNumber: parsed.settings?.contactNumber || DEFAULT_SETTINGS.contactNumber,
        contactEmail: parsed.settings?.contactEmail || DEFAULT_SETTINGS.contactEmail,
        customLogoUrl:
          parsed.settings && 'customLogoUrl' in parsed.settings
            ? (parsed.settings.customLogoUrl ?? null)
            : null,
        pricingTiers:
          parsed.settings?.pricingTiers && parsed.settings.pricingTiers.length > 0
            ? parsed.settings.pricingTiers
            : DEFAULT_SETTINGS.pricingTiers,
        headlineTemplate: {
          ...DEFAULT_SETTINGS.headlineTemplate,
          ...(parsed.settings?.headlineTemplate ?? {}),
        },
        highlightOfTheMonth: {
          ...DEFAULT_SETTINGS.highlightOfTheMonth,
          ...(parsed.settings?.highlightOfTheMonth ?? {}),
        },
        certificateTemplate: {
          ...DEFAULT_SETTINGS.certificateTemplate!,
          ...(parsed.settings?.certificateTemplate ?? {}),
        },
      },
      awardees: Array.isArray(parsed.awardees) ? parsed.awardees : DEFAULT_AWARDEES,
      legitimacyCredentials: parsed.legitimacyCredentials ?? [],
      projectFunding: Array.isArray(parsed.projectFunding)
        ? parsed.projectFunding
        : DEFAULT_PROJECT_FUNDING,
      nominationEvaluations: Array.isArray(parsed.nominationEvaluations)
        ? parsed.nominationEvaluations
        : DEFAULT_EVALUATIONS,
      departmentPasscodes: {
        ...DEFAULT_DEPARTMENT_PASSCODES,
        ...(parsed.departmentPasscodes ?? {}),
      },
      chatThreads: parsed.chatThreads ?? [],
      supportAvailable: parsed.supportAvailable ?? false,
      adminRevisions: parsed.adminRevisions ?? [],
      lastSequence: parsed.lastSequence ?? 2,
    };
  } catch {
    const initial = createInitialDb();
    saveDb(initial);
    return initial;
  }
}

export function saveDb(db: PemaDatabase): void {
  ensureDirectories();
  const tmpPath = `${DB_FILE}.tmp`;
  const payload = JSON.stringify(db, null, 2);
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeFileSync(fd, payload, 'utf-8');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmpPath, DB_FILE);
}

const ALLOWED_MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
};

export function saveBase64Upload(params: {
  fileName: string;
  dataUrl: string;
  prefix: string;
}): UploadedFileRef {
  ensureDirectories();
  const { fileName, dataUrl, prefix } = params;
  const match = dataUrl.match(/^data:([^;]*);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid file data payload.');
  }
  const mimeType = (match[1] || 'application/octet-stream').toLowerCase();
  const base64Body = match[2];
  const extFromMime = ALLOWED_MIME_EXT[mimeType];
  const safeOrigName = path.basename(fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
  const extFromName = path.extname(safeOrigName).toLowerCase();
  const ext = extFromMime || (extFromName && /^[.][a-z0-9]{1,8}$/.test(extFromName) ? extFromName : '.bin');

  const buffer = Buffer.from(base64Body, 'base64');

  const storedName = `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOADS_DIR, storedName), buffer);

  return {
    fileName: safeOrigName,
    storedName,
    mimeType,
    sizeBytes: buffer.length,
    url: `/api/uploads/${storedName}`,
    uploadedAt: new Date().toISOString(),
  };
}
