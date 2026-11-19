import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateNominationForm,
  validateChatIntake,
  normalizeAuthorizedAdminName,
  computePaymentSummary,
  formatPhpCurrency,
  generateReferenceCode,
  parseLiveBundleContent,
  buildNominationStatusEmail,
  NOMINATION_EVALUATION_CRITERIA,
  NOMINATION_CATEGORY_CLUSTERS,
  filterNominations,
  exportNominationsToCsv,
  getAllowedTabsForRole,
  canRoleMutatePayments,
  canRoleMutateFunding,
  canRoleClearFundingFinance,
  canRoleDecideNomination,
  canRoleScoreEvaluatorSlot,
  normalizeCriteriaScores,
  computeBoardConsensus,
  computeFundingSummary,
  countMandatoryFieldsValid,
  NOMINATION_FIELD_LIMITS,
} from './pemaRules';
import {
  buildNominationSummaryPdfBytes,
  getNominationSummaryPdfFilename,
} from './nominationPdf';
import {
  deriveBiometricUiState,
  mapWebAuthnErrorToFriendlyMessage,
  parsePasskeyDeviceLabel,
  resolveWebAuthnRpAndOrigin,
  shouldAutoTriggerBiometricPrompt,
} from './biometricAuth';
import type {
  NominationEvaluationScore,
  NominationRecord,
  PaymentRecord,
  ProjectFundingRecord,
} from '../types/pema';

test('validateNominationForm accepts complete valid submission', () => {
  const res = validateNominationForm({
    completeName: 'Dr. Maria Clara Santos',
    phoneNumber: '0924-173-7587',
    emailAddress: 'maria.santos@example.ph',
    currentAge: '42',
    completeAddress: '148 Ayala Avenue, Makati City, Metro Manila 1226',
    currentWorkProfession: 'Chief Medical Officer & Community Health Advocate',
    cvWillFollow: true,
    majorProjects: 'Rural Telehealth Initiative across 18 provinces',
  });

  assert.equal(res.valid, true);
  assert.deepEqual(res.errors, {});
  assert.equal(res.parsedAge, 42);
});

test('validateNominationForm rejects missing or malformed required fields', () => {
  const res = validateNominationForm({
    completeName: 'A',
    phoneNumber: '123',
    emailAddress: 'not-an-email',
    currentAge: '5',
    completeAddress: 'PH',
    currentWorkProfession: '',
  });

  assert.equal(res.valid, false);
  assert.ok(res.errors.completeName);
  assert.ok(res.errors.phoneNumber);
  assert.ok(res.errors.emailAddress);
  assert.ok(res.errors.currentAge);
  assert.ok(res.errors.completeAddress);
  assert.ok(res.errors.currentWorkProfession);
  assert.equal(res.parsedAge, null);
});

test('validateChatIntake enforces 10-char min, 200-char max inquiry and max 2 attachments', () => {
  const tooShortRes = validateChatIntake({
    customerName: 'Maria Santos',
    contactNumber: '0924-173-7587',
    inquiryReason: 'Too short', // 9 chars
    attachmentCount: 3,
  });
  assert.equal(tooShortRes.valid, false);
  assert.match(tooShortRes.errors.inquiryReason ?? '', /at least 10 characters/i);
  assert.ok(tooShortRes.errors.attachments);

  const tooLongRes = validateChatIntake({
    customerName: 'Maria Santos',
    contactNumber: '0924-173-7587',
    inquiryReason: 'A'.repeat(201),
    attachmentCount: 1,
  });
  assert.equal(tooLongRes.valid, false);
  assert.match(tooLongRes.errors.inquiryReason ?? '', /within 200 characters/i);

  const validRes = validateChatIntake({
    customerName: 'Maria Santos',
    contactNumber: '0924-173-7587',
    inquiryReason: 'A'.repeat(104),
    attachmentCount: 2,
  });
  assert.equal(validRes.valid, true);
  assert.deepEqual(validRes.errors, {});

  const exactMinRes = validateChatIntake({
    customerName: 'Maria Santos',
    contactNumber: '0924-173-7587',
    inquiryReason: 'Help me!12',
    attachmentCount: 0,
  });
  assert.equal(exactMinRes.valid, true);
});

test('normalizeAuthorizedAdminName permits only Princess and Jreal', () => {
  assert.equal(normalizeAuthorizedAdminName('Princess'), 'Princess');
  assert.equal(normalizeAuthorizedAdminName('  jreal  '), 'Jreal');
  assert.equal(normalizeAuthorizedAdminName('Admin'), null);
  assert.equal(normalizeAuthorizedAdminName(''), null);
});

test('computePaymentSummary calculates billed, paid, outstanding, and receipt counts', () => {
  const sample: PaymentRecord[] = [
    {
      id: 'pay-1',
      receiptReference: 'OR-2027-0001',
      nominationId: 'nom-1',
      userId: 'usr-1',
      payerName: 'Juan Dela Cruz',
      payerEmail: 'juan@example.ph',
      payerPhone: '09171234567',
      description: 'Awardee Gala Package',
      amountDue: 15000,
      amountPaid: 15000,
      currency: 'PHP',
      paymentMethod: 'Bank Transfer',
      paymentDate: '2026-11-10',
      status: 'Paid / Verified',
      userProofFile: null,
      officialReceiptFile: {
        fileName: 'receipt.png',
        storedName: 'r1.png',
        mimeType: 'image/png',
        sizeBytes: 2048,
        url: '/api/uploads/r1.png',
        uploadedAt: '2026-11-10T10:00:00Z',
      },
      adminRemarks: 'Verified',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-10T10:00:00Z',
    },
    {
      id: 'pay-2',
      receiptReference: 'OR-2027-0002',
      nominationId: 'nom-2',
      userId: 'usr-2',
      payerName: 'Ana Reyes',
      payerEmail: 'ana@example.ph',
      payerPhone: '09181234567',
      description: 'Nomination Processing Fee',
      amountDue: 5000,
      amountPaid: 2000,
      currency: 'PHP',
      paymentMethod: 'GCash',
      paymentDate: '2026-11-15',
      status: 'Partial',
      userProofFile: null,
      officialReceiptFile: null,
      adminRemarks: 'Partial deposit received',
      createdAt: '2026-11-05T00:00:00Z',
      updatedAt: '2026-11-15T10:00:00Z',
    },
  ];

  const summary = computePaymentSummary(sample);
  assert.equal(summary.totalRecords, 2);
  assert.equal(summary.totalBilledPhp, 20000);
  assert.equal(summary.totalPaidPhp, 17000);
  assert.equal(summary.outstandingPhp, 3000);
  assert.equal(summary.verifiedCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.receiptCount, 1);
});

test('formatPhpCurrency and generateReferenceCode format cleanly', () => {
  assert.equal(formatPhpCurrency(null), 'To be confirmed');
  assert.match(formatPhpCurrency(15000), /15,000\.00/);
  assert.equal(generateReferenceCode('PEMA', 7, 2027), 'PEMA-2027-0007');
});

test('parseLiveBundleContent extracts live copy and FAQ questions from bundle JS', () => {
  const mockBundle = `
    const pageCopy = {
      about: ["About PEMA", "A standard worth reaching for.", "Updated live mission statement."],
      services: ["Our services", "More than an award. A platform."],
      pricing: ["Pricing", "Your achievement, thoughtfully presented."]
    };
    function FAQ() {
      const faqs = ["Who can be nominated?", "How does the nomination process work?"];
      return null;
    }
  `;
  const parsed = parseLiveBundleContent(mockBundle);
  assert.deepEqual(parsed.about, [
    'About PEMA',
    'A standard worth reaching for.',
    'Updated live mission statement.',
  ]);
  assert.deepEqual(parsed.faqQuestions, [
    'Who can be nominated?',
    'How does the nomination process work?',
  ]);
});

test('buildNominationStatusEmail formats Approved and Rejected notifications', () => {
  const approved = buildNominationStatusEmail({
    recipientName: 'Dr. Elena Villanueva',
    referenceCode: 'PEMA-2027-0001',
    newStatus: 'Approved',
    committeeNotes: 'Unanimous committee endorsement.',
  });
  assert.match(approved.subject, /Approved.*PEMA-2027-0001/);
  assert.match(approved.body, /APPROVED/);
  assert.match(approved.body, /Unanimous committee endorsement/);

  const rejected = buildNominationStatusEmail({
    recipientName: 'Juan Dela Cruz',
    referenceCode: 'PEMA-2027-0009',
    newStatus: 'Rejected',
  });
  assert.match(rejected.subject, /PEMA-2027-0009/);
  assert.match(rejected.body, /Rejected/);
  assert.match(rejected.body, /0924-173-7587/);
});

test('NOMINATION_EVALUATION_CRITERIA totals 100% and NOMINATION_CATEGORY_CLUSTERS has 8x3 awards', () => {
  const sum = NOMINATION_EVALUATION_CRITERIA.reduce((acc, item) => acc + item.weightPercent, 0);
  assert.equal(NOMINATION_EVALUATION_CRITERIA.length, 6);
  assert.equal(sum, 100);

  assert.equal(NOMINATION_CATEGORY_CLUSTERS.length, 8);
  for (const cluster of NOMINATION_CATEGORY_CLUSTERS) {
    assert.equal(cluster.awards.length, 3);
  }
});

test('filterNominations matches name, email, reference code, and status reliably', () => {
  const records: NominationRecord[] = [
    {
      id: 'nom-1',
      referenceCode: 'PEMA-2027-0001',
      userId: 'usr-1',
      completeName: 'Dr. Elena M. Villanueva',
      phoneNumber: '0917-555-0148',
      emailAddress: 'elena.villanueva@example.ph',
      currentAge: 44,
      completeAddress: 'Makati City',
      currentWorkProfession: 'Public Health Director',
      cvWillFollow: false,
      cvFile: null,
      majorProjects: 'Mobile clinics across Luzon',
      supportingDocs: [],
      status: 'Approved',
      committeeNotes: 'Verified',
      createdAt: '2026-11-06T11:15:00.000Z',
      updatedAt: '2026-11-12T14:20:00.000Z',
    },
    {
      id: 'nom-2',
      referenceCode: 'PEMA-2027-0002',
      userId: null,
      completeName: 'Engr. Marco Reyes',
      phoneNumber: '0928-441-8890',
      emailAddress: 'marco.reyes@example.ph',
      currentAge: 38,
      completeAddress: 'Cebu City',
      currentWorkProfession: 'Microgrid Systems Engineer',
      cvWillFollow: true,
      cvFile: null,
      majorProjects: 'Solar microgrids, island schools',
      supportingDocs: [],
      status: 'Pending',
      committeeNotes: 'Queued for review',
      createdAt: '2026-11-14T08:45:00.000Z',
      updatedAt: '2026-11-15T16:00:00.000Z',
    },
  ];

  assert.equal(filterNominations(records, 'elena', 'ALL').length, 1);
  assert.equal(filterNominations(records, 'marco.reyes@example.ph', 'ALL').length, 1);
  assert.equal(filterNominations(records, 'Pending', 'ALL')[0]?.id, 'nom-2');
  assert.equal(filterNominations(records, '', 'Approved')[0]?.id, 'nom-1');
  assert.equal(filterNominations(records, 'elena', 'Pending').length, 0);

  const csv = exportNominationsToCsv(records);
  assert.ok(csv.startsWith('\uFEFFReference Code,Complete Name,'));
  assert.match(csv, /PEMA-2027-0001,Dr\. Elena M\. Villanueva,elena\.villanueva@example\.ph/);
  assert.match(csv, /"Solar microgrids, island schools"/);
});

test('departmental RBAC strictly isolates Funding, Finance, Committee on Board, and Evaluators 1-4', () => {
  assert.equal(canRoleMutateFunding('funding'), true);
  assert.equal(canRoleMutatePayments('funding'), false);
  assert.equal(canRoleDecideNomination('funding'), false);

  assert.equal(canRoleMutatePayments('finance'), true);
  assert.equal(canRoleClearFundingFinance('finance'), true);
  assert.equal(canRoleMutateFunding('finance'), false);
  assert.equal(canRoleDecideNomination('finance'), false);

  assert.equal(canRoleDecideNomination('committee'), true);
  assert.equal(canRoleMutatePayments('committee'), false);
  assert.equal(canRoleMutateFunding('committee'), false);

  assert.equal(canRoleScoreEvaluatorSlot('evaluator_1', 'evaluator_1'), true);
  assert.equal(canRoleScoreEvaluatorSlot('evaluator_1', 'evaluator_2'), false);
  assert.equal(canRoleDecideNomination('evaluator_1'), false);
  assert.equal(canRoleMutatePayments('evaluator_3'), false);

  assert.deepEqual(getAllowedTabsForRole('evaluator_2'), ['board']);
  assert.ok(getAllowedTabsForRole('executive').includes('departments'));
});

test('normalizeCriteriaScores clamps weights to 100% max and computeBoardConsensus averages correctly', () => {
  const { breakdown, totalScore } = normalizeCriteriaScores({
    achievements: 30, // clamped to 25
    communityImpact: 24,
    leadership: 20,
    integrity: 15,
    innovation: -2, // clamped to 0
    supportingDocs: 5,
  });
  assert.equal(breakdown.achievements, 25);
  assert.equal(breakdown.innovation, 0);
  assert.equal(totalScore, 89);

  const sampleEvals: NominationEvaluationScore[] = [
    {
      id: 'ev-1',
      nominationId: 'nom-1',
      evaluatorSlot: 'evaluator_1',
      evaluatorLabel: 'Evaluator 1',
      evaluatorName: 'Atty. Reyes',
      criteriaScores: breakdown,
      totalScore: 89,
      recommendation: 'Recommend Approval',
      remarks: 'Strong achievements.',
      updatedAt: '2026-11-18T00:00:00Z',
    },
    {
      id: 'ev-2',
      nominationId: 'nom-1',
      evaluatorSlot: 'evaluator_2',
      evaluatorLabel: 'Evaluator 2',
      evaluatorName: 'Dr. Bautista',
      criteriaScores: breakdown,
      totalScore: 95,
      recommendation: 'For Board Deliberation',
      remarks: 'Verify supplemental letter.',
      updatedAt: '2026-11-18T00:00:00Z',
    },
  ];
  const consensus = computeBoardConsensus(sampleEvals);
  assert.equal(consensus.submittedCount, 2);
  assert.equal(consensus.averageScore, 92);
  assert.equal(consensus.recommendApprovalCount, 1);
  assert.equal(consensus.forDeliberationCount, 1);
});

test('computeFundingSummary aggregates target, committed, disbursed, and finance clearance counts', () => {
  const items: ProjectFundingRecord[] = [
    {
      id: 'f1',
      programCode: 'FUND-2027-0001',
      title: 'Gala Stage & Broadcast Fund',
      sourceOrSponsor: 'Bayani Institutional Partners',
      fundingType: 'Ceremony Sponsorship',
      targetAmountPhp: 500000,
      committedAmountPhp: 350000,
      disbursedAmountPhp: 150000,
      financeClearanceStatus: 'Finance Verified',
      status: 'Partially Disbursed',
      notes: '',
      updatedBy: 'Funding Officer',
      createdAt: '2026-11-10T00:00:00Z',
      updatedAt: '2026-11-12T00:00:00Z',
    },
    {
      id: 'f2',
      programCode: 'FUND-2027-0002',
      title: 'Honoree Folio & Medal Minting',
      sourceOrSponsor: 'Manila Heritage Foundation',
      fundingType: 'Institutional Grant',
      targetAmountPhp: 200000,
      committedAmountPhp: 200000,
      disbursedAmountPhp: 0,
      financeClearanceStatus: 'Pending Finance Review',
      status: 'Active Pledge',
      notes: '',
      updatedBy: 'Funding Officer',
      createdAt: '2026-11-11T00:00:00Z',
      updatedAt: '2026-11-13T00:00:00Z',
    },
  ];

  const sum = computeFundingSummary(items);
  assert.equal(sum.totalInitiatives, 2);
  assert.equal(sum.totalTargetPhp, 700000);
  assert.equal(sum.totalCommittedPhp, 550000);
  assert.equal(sum.totalDisbursedPhp, 150000);
  assert.equal(sum.remainingToTargetPhp, 150000);
  assert.equal(sum.financeVerifiedCount, 1);
});

test('countMandatoryFieldsValid tracks real-time nomination readiness and upper bounds', () => {
  const partial = countMandatoryFieldsValid({
    completeName: 'Dr. Jose Rizal',
    phoneNumber: '0924',
    emailAddress: 'invalid-email',
    currentAge: '40',
    completeAddress: '123 Dapitan St, Manila',
    currentWorkProfession: 'Physician',
  });
  assert.equal(partial.validCount, 4);
  assert.equal(partial.totalCount, 6);
  assert.equal(partial.ready, false);

  const overLimit = validateNominationForm({
    completeName: 'A'.repeat(NOMINATION_FIELD_LIMITS.completeName.max + 1),
    phoneNumber: '0924-173-7587',
    emailAddress: 'valid@example.ph',
    currentAge: '40',
    completeAddress: '123 Dapitan St, Manila',
    currentWorkProfession: 'Physician',
    majorProjects: 'P'.repeat(NOMINATION_FIELD_LIMITS.majorProjects.max + 5),
  });
  assert.equal(overLimit.valid, false);
  assert.ok(overLimit.errors.completeName);
  assert.ok(overLimit.errors.majorProjects);
});

test('buildNominationSummaryPdfBytes generates valid PDF binary with sanitized filename', () => {
  const record: NominationRecord = {
    id: 'nom-pdf-1',
    referenceCode: 'PEMA-2027-0099',
    userId: 'usr-1',
    completeName: 'Dr. Elena M. Villanueva',
    phoneNumber: '0917-555-0148',
    emailAddress: 'elena.villanueva@example.ph',
    currentAge: 44,
    completeAddress: '214 Salcedo Street, Legazpi Village, Makati City',
    currentWorkProfession: 'Public Health Director',
    cvWillFollow: false,
    cvFile: {
      fileName: 'villanueva-cv.pdf',
      storedName: 'villanueva-cv.pdf',
      url: '/uploads/villanueva-cv.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24500,
      uploadedAt: '2026-11-18T08:30:00.000Z',
    },
    majorProjects: 'Established 18 rural primary care clinics across Northern Luzon.',
    supportingDocs: [
      {
        fileName: 'doh-citation.pdf',
        storedName: 'doh-citation.pdf',
        url: '/uploads/doh-citation.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12000,
        uploadedAt: '2026-11-18T08:30:00.000Z',
      },
    ],
    status: 'Approved',
    committeeNotes: 'Endorsed unanimously by the Committee on Board.',
    createdAt: '2026-11-18T08:30:00.000Z',
    updatedAt: '2026-11-18T09:15:00.000Z',
  };

  const filename = getNominationSummaryPdfFilename(record);
  assert.equal(filename, 'PEMA-2027-0099-Nomination-Summary.pdf');

  const bytes = buildNominationSummaryPdfBytes(record);
  assert.ok(bytes.length > 500);
  const header = new TextDecoder().decode(bytes.slice(0, 8));
  assert.match(header, /^%PDF-1\./);
});

test('resolveWebAuthnRpAndOrigin derives exact rpID and origin for localhost and Cloud Run', () => {
  const local = resolveWebAuthnRpAndOrigin({
    originHeader: 'http://localhost:3000',
    hostHeader: 'localhost:3000',
  });
  assert.deepEqual(local, { origin: 'http://localhost:3000', rpID: 'localhost' });

  const cloudRun = resolveWebAuthnRpAndOrigin({
    forwardedProto: 'https',
    forwardedHost: 'pema-portal-909702787513.asia-east1.run.app',
  });
  assert.deepEqual(cloudRun, {
    origin: 'https://pema-portal-909702787513.asia-east1.run.app',
    rpID: 'pema-portal-909702787513.asia-east1.run.app',
  });
});

test('parsePasskeyDeviceLabel and mapWebAuthnErrorToFriendlyMessage produce clear device labels and messages', () => {
  assert.equal(
    parsePasskeyDeviceLabel('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131 Mobile'),
    'Android Fingerprint / Biometrics',
  );
  assert.equal(
    parsePasskeyDeviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'),
    'iPhone / iPad Face ID or Touch ID',
  );
  assert.equal(
    parsePasskeyDeviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),
    'Windows Hello Biometrics',
  );

  const iframeMsg = mapWebAuthnErrorToFriendlyMessage(
    new Error('The operation either timed out or was not allowed by permissions policy publickey-credentials-get'),
    'login',
  );
  assert.match(iframeMsg, /embedded preview frame/i);

  const dupMsg = mapWebAuthnErrorToFriendlyMessage(
    new Error('InvalidStateError: credential already exists'),
    'register',
  );
  assert.match(dupMsg, /already linked/i);
});

test('deriveBiometricUiState reflects syncing, registered returning user, available, checking, and password-only states', () => {
  const syncing = deriveBiometricUiState({
    supported: true,
    checkingHardware: false,
    platformReady: true,
    isSyncing: true,
    isReturningRegistered: true,
    registeredDeviceLabel: 'Android Fingerprint / Biometrics',
    targetEmail: 'elena.villanueva@example.ph',
  });
  assert.equal(syncing.state, 'syncing');
  assert.match(syncing.headline, /Syncing with Device Security Module/i);

  const registered = deriveBiometricUiState({
    supported: true,
    checkingHardware: false,
    platformReady: true,
    isSyncing: false,
    isReturningRegistered: true,
    registeredDeviceLabel: 'Android Fingerprint / Biometrics',
    targetEmail: 'elena.villanueva@example.ph',
  });
  assert.equal(registered.state, 'registered');
  assert.match(registered.headline, /Biometric Login Ready/i);
  assert.match(registered.detail, /elena\.villanueva@example\.ph/i);

  const available = deriveBiometricUiState({
    supported: true,
    checkingHardware: false,
    platformReady: true,
    isSyncing: false,
    isReturningRegistered: false,
  });
  assert.equal(available.state, 'available');
  assert.match(available.headline, /Device Biometrics Available/i);

  const checking = deriveBiometricUiState({
    supported: true,
    checkingHardware: true,
    platformReady: false,
    isSyncing: false,
    isReturningRegistered: false,
  });
  assert.equal(checking.state, 'checking');

  const passwordOnly = deriveBiometricUiState({
    supported: false,
    checkingHardware: false,
    platformReady: false,
    isSyncing: false,
    isReturningRegistered: false,
  });
  assert.equal(passwordOnly.state, 'password_only');
});

test('shouldAutoTriggerBiometricPrompt triggers only when login has verified passkey, ready hardware, and no override', () => {
  const base = {
    activeMode: 'login' as const,
    checkingHardware: false,
    biometricSupported: true,
    platformSensorReady: true,
    hasVerifiedServerPasskey: true,
    alreadyAutoPrompted: false,
    passwordPreferred: false,
    biometricLoading: false,
    loading: false,
  };

  assert.equal(shouldAutoTriggerBiometricPrompt(base), true);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, activeMode: 'signup' }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, checkingHardware: true }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, biometricSupported: false }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, platformSensorReady: false }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, hasVerifiedServerPasskey: false }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, alreadyAutoPrompted: true }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, passwordPreferred: true }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, biometricLoading: true }), false);
  assert.equal(shouldAutoTriggerBiometricPrompt({ ...base, loading: true }), false);
});



