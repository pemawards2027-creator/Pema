import { AlertCircle, CheckCircle2, FileText, Printer, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { usePema } from '../context/PemaContext';
import type { NominationRecord } from '../types/pema';
import { apiFetch, fileToPayload, type FileUploadPayload } from '../utils/api';
import {
  countMandatoryFieldsValid,
  NOMINATION_FIELD_LIMITS,
  validateNominationForm,
  type ValidationErrors,
} from '../utils/pemaRules';

interface NominationFormPageProps {
  onNavigate: (path: string) => void;
}

export function NominationFormPage({ onNavigate }: NominationFormPageProps) {
  const { user, loadingAuth } = usePema();

  const [completeName, setCompleteName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [currentAge, setCurrentAge] = useState('');
  const [completeAddress, setCompleteAddress] = useState('');
  const [currentWorkProfession, setCurrentWorkProfession] = useState('');
  const [cvWillFollow, setCvWillFollow] = useState(true);
  const [cvUpload, setCvUpload] = useState<FileUploadPayload | null>(null);
  const [majorProjects, setMajorProjects] = useState('');
  const [supportingUploads, setSupportingUploads] = useState<FileUploadPayload[]>([]);

  const [touchedFields, setTouchedFields] = useState<Partial<Record<keyof ValidationErrors, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<NominationRecord | null>(null);

  useEffect(() => {
    if (user) {
      setCompleteName((prev) => prev || user.fullName);
      setEmailAddress((prev) => prev || user.email);
      setPhoneNumber((prev) => prev || user.phoneNumber || '');
    }
  }, [user]);

  const liveInput = useMemo(
    () => ({
      completeName,
      phoneNumber,
      emailAddress,
      currentAge,
      completeAddress,
      currentWorkProfession,
      cvWillFollow,
      hasCvFile: Boolean(cvUpload),
      majorProjects,
    }),
    [
      completeName,
      phoneNumber,
      emailAddress,
      currentAge,
      completeAddress,
      currentWorkProfession,
      cvWillFollow,
      cvUpload,
      majorProjects,
    ],
  );

  const liveValidation = useMemo(() => validateNominationForm(liveInput), [liveInput]);
  const mandatoryProgress = useMemo(() => countMandatoryFieldsValid(liveInput), [liveInput]);

  const markTouched = (field: keyof ValidationErrors) => {
    setTouchedFields((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
    if (serverFieldErrors[field]) {
      setServerFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const getVisibleError = (field: keyof ValidationErrors): string | undefined => {
    if (serverFieldErrors[field]) return serverFieldErrors[field];
    if (submitAttempted || touchedFields[field]) {
      return liveValidation.errors[field];
    }
    return undefined;
  };

  const isFieldVerified = (field: keyof ValidationErrors, value: string): boolean => {
    return value.trim().length > 0 && !liveValidation.errors[field] && !serverFieldErrors[field];
  };

  const phoneDigitCount = phoneNumber.replace(/\D/g, '').length;

  const handleCvSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const payload = await fileToPayload(file);
      setCvUpload(payload);
      setCvWillFollow(false);
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to attach CV/PDS.');
    }
  };

  const handleSupportingSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    if (files.length === 0) return;
    try {
      const payloads = await Promise.all(files.map(fileToPayload));
      setSupportingUploads((prev) => [...prev, ...payloads].slice(0, 5));
      setSubmitError(null);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to attach supporting document.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitAttempted(true);

    if (!liveValidation.valid) {
      setSubmitError(
        `Please complete all mandatory fields correctly (${mandatoryProgress.validCount} of ${mandatoryProgress.totalCount} verified) before submitting.`,
      );
      return;
    }

    setServerFieldErrors({});
    setSubmitting(true);

    try {
      const res = await apiFetch<{ nomination: NominationRecord }>('/api/nominations', {
        method: 'POST',
        body: JSON.stringify({
          completeName,
          phoneNumber,
          emailAddress,
          currentAge: liveValidation.parsedAge,
          completeAddress,
          currentWorkProfession,
          cvWillFollow: cvUpload ? false : cvWillFollow,
          cvUpload,
          majorProjects,
          supportingUploads,
        }),
      });
      setSubmittedRecord(res.nomination);
    } catch (err) {
      const eObj = err as Error & { fieldErrors?: ValidationErrors };
      if (eObj.fieldErrors) setServerFieldErrors(eObj.fieldErrors);
      setSubmitError(eObj.message || 'Could not submit nomination.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRecord) {
    return (
      <div className="bg-[#FAF8F4] py-16 px-4">
        <div className="max-w-2xl mx-auto bg-white border border-[#D9A726]/45 rounded-2xl p-8 sm:p-10 text-center space-y-6">
          <div className="flex justify-center">
            <OfficialSealMedallion size="md" />
          </div>
          <CheckCircle2 className="h-10 w-10 text-emerald-700 mx-auto" aria-hidden="true" />
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#C89212]">
              Nomination Recorded
            </p>
            <h1 className="font-display text-3xl font-bold text-[#08184B]">
              Thank you, {submittedRecord.completeName}
            </h1>
            <p className="text-sm text-[#08184B]/75">
              Reference Code:{' '}
              <span className="font-mono font-semibold text-[#08184B]">
                {submittedRecord.referenceCode}
              </span>
            </p>
          </div>

          <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 text-xs text-[#08184B]/80 text-left leading-relaxed">
            <strong>IMPORTANT NOTE:</strong> Nomination does not automatically guarantee an award.
            All nominees undergo evaluation based on the established criteria and the supporting
            information provided.
          </div>

          <div className="no-print flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print Confirmation</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate(user ? '/account' : '/signup')}
              className="px-6 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
            >
              {user ? 'View in My Account' : 'Create Account to Track Status & Receipts'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedRecord(null);
                setTouchedFields({});
                setSubmitAttempted(false);
                setServerFieldErrors({});
                setSubmitError(null);
                setCompleteName(user?.fullName ?? '');
                setPhoneNumber(user?.phoneNumber ?? '');
                setEmailAddress(user?.email ?? '');
                setCurrentAge('');
                setCompleteAddress('');
                setCurrentWorkProfession('');
                setCvUpload(null);
                setMajorProjects('');
                setSupportingUploads([]);
              }}
              className="px-5 py-3 text-sm font-semibold text-[#08184B] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
            >
              Submit another nomination
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loadingAuth && !user) {
    return (
      <div className="bg-[#FAF8F4] py-16 px-4">
        <div className="max-w-2xl mx-auto bg-white border border-[#D9A726]/45 rounded-2xl p-8 sm:p-10 text-center space-y-6">
          <div className="flex justify-center">
            <OfficialSealMedallion size="md" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
              Member Account Required
            </p>
            <h1 className="font-display text-3xl font-bold text-[#08184B]">
              Create a PEMA Account to Submit Your Nomination
            </h1>
            <p className="text-sm text-[#08184B]/75 leading-relaxed max-w-lg mx-auto">
              To protect nominee records, track evaluation milestones, upload supporting CV/PDS files,
              and access PEMA Chat Support, please register or sign in to your PEMA Member Account first.
            </p>
          </div>

          <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 text-xs text-[#08184B]/80 text-left leading-relaxed">
            <strong>IMPORTANT NOTE:</strong> Nomination does not automatically guarantee an award.
            All nominees undergo evaluation based on the established criteria and the supporting
            information provided.
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/signup')}
              className="px-6 py-3 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg cursor-pointer"
            >
              Create PEMA Account
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="px-6 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
            >
              Sign In to Existing Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="print-form-sheet bg-[#FAF8F4] py-12 lg:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Official Branded Header */}
        <div className="print-avoid-break print-flat-card bg-[#08184B] text-white rounded-2xl p-7 sm:p-9 border border-[#D9A726]/35 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <OfficialSealMedallion size="md" />
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D9A726]">
                Official Nomination Form · PEMA
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold leading-snug text-balance">
                Kindly fill-in the required details to submit your nomination!
              </h1>
              <p className="text-sm text-white/75">
                Submitting under signed-in member account ({user?.email}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            data-testid="print-nomination-form-btn"
            className="no-print inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Print Form / Save PDF</span>
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="print-flat-card bg-white border border-[#08184B]/12 rounded-2xl p-7 sm:p-10 space-y-8"
        >
          {submitError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 text-sm text-red-800"
            >
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Required Section */}
          <div className="space-y-6">
            <div className="border-b border-[#08184B]/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-display text-xl font-bold text-[#08184B]">
                Required Nominee Information
              </h2>
              <span
                data-testid="nomination-readiness-badge"
                className={`no-print inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1 rounded-lg border tabular-nums ${
                  mandatoryProgress.ready
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-[#FAF8F4] text-[#08184B] border-[#08184B]/15'
                }`}
              >
                {mandatoryProgress.validCount} / {mandatoryProgress.totalCount} mandatory fields valid
              </span>
            </div>

            {/* • Complete name */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor="nom-complete-name" className="text-sm font-semibold text-[#08184B]">
                  • Complete name: <span className="text-[#A81C1C]">*</span>
                </label>
                <span
                  data-testid="count-completeName"
                  className={`no-print text-[11px] font-mono tabular-nums ${
                    isFieldVerified('completeName', completeName)
                      ? 'text-emerald-700 font-semibold'
                      : getVisibleError('completeName')
                        ? 'text-red-700 font-semibold'
                        : 'text-[#08184B]/60'
                  }`}
                >
                  {completeName.trim().length} / {NOMINATION_FIELD_LIMITS.completeName.max} chars
                </span>
              </div>
              <input
                id="nom-complete-name"
                type="text"
                required
                maxLength={NOMINATION_FIELD_LIMITS.completeName.max}
                aria-invalid={Boolean(getVisibleError('completeName'))}
                value={completeName}
                onChange={(e) => {
                  setCompleteName(e.target.value);
                  markTouched('completeName');
                }}
                onBlur={() => markTouched('completeName')}
                placeholder="First Name, Middle Name, Last Name (with Title if applicable)"
                className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:outline-none ${
                  getVisibleError('completeName')
                    ? 'border-red-500 focus:border-red-600'
                    : isFieldVerified('completeName', completeName)
                      ? 'border-emerald-600/60 focus:border-[#08184B]'
                      : 'border-[#08184B]/20 focus:border-[#08184B]'
                }`}
              />
              {getVisibleError('completeName') ? (
                <p data-testid="error-completeName" className="mt-1 text-xs text-red-700">
                  {getVisibleError('completeName')}
                </p>
              ) : isFieldVerified('completeName', completeName) ? (
                <p className="no-print mt-1 text-xs text-emerald-700">Verified</p>
              ) : null}
            </div>

            {/* • Contact information: (Phone number and Email address) */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#08184B]">
                • Contact information: <span className="font-normal text-[#08184B]/65">(Phone number and Email address)</span>{' '}
                <span className="text-[#A81C1C]">*</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor="nom-phone" className="text-xs font-medium text-[#08184B]/75">
                      Phone number
                    </label>
                    <span
                      data-testid="count-phoneNumber"
                      className={`no-print text-[11px] font-mono tabular-nums ${
                        isFieldVerified('phoneNumber', phoneNumber)
                          ? 'text-emerald-700 font-semibold'
                          : getVisibleError('phoneNumber')
                            ? 'text-red-700 font-semibold'
                            : 'text-[#08184B]/60'
                      }`}
                    >
                      {phoneDigitCount} / {NOMINATION_FIELD_LIMITS.phoneNumber.minDigits}–
                      {NOMINATION_FIELD_LIMITS.phoneNumber.maxDigits} digits
                    </span>
                  </div>
                  <input
                    id="nom-phone"
                    type="tel"
                    required
                    maxLength={NOMINATION_FIELD_LIMITS.phoneNumber.max}
                    aria-invalid={Boolean(getVisibleError('phoneNumber'))}
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      markTouched('phoneNumber');
                    }}
                    onBlur={() => markTouched('phoneNumber')}
                    placeholder="e.g. 0924-173-7587"
                    className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:outline-none ${
                      getVisibleError('phoneNumber')
                        ? 'border-red-500 focus:border-red-600'
                        : isFieldVerified('phoneNumber', phoneNumber)
                          ? 'border-emerald-600/60 focus:border-[#08184B]'
                          : 'border-[#08184B]/20 focus:border-[#08184B]'
                    }`}
                  />
                  {getVisibleError('phoneNumber') ? (
                    <p data-testid="error-phoneNumber" className="mt-1 text-xs text-red-700">
                      {getVisibleError('phoneNumber')}
                    </p>
                  ) : isFieldVerified('phoneNumber', phoneNumber) ? (
                    <p className="no-print mt-1 text-xs text-emerald-700">Verified</p>
                  ) : null}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label htmlFor="nom-email" className="text-xs font-medium text-[#08184B]/75">
                      Email address
                    </label>
                    <span
                      data-testid="count-emailAddress"
                      className={`no-print text-[11px] font-mono tabular-nums ${
                        isFieldVerified('emailAddress', emailAddress)
                          ? 'text-emerald-700 font-semibold'
                          : getVisibleError('emailAddress')
                            ? 'text-red-700 font-semibold'
                            : 'text-[#08184B]/60'
                      }`}
                    >
                      {emailAddress.trim().length} / {NOMINATION_FIELD_LIMITS.emailAddress.max} chars
                    </span>
                  </div>
                  <input
                    id="nom-email"
                    type="email"
                    required
                    maxLength={NOMINATION_FIELD_LIMITS.emailAddress.max}
                    aria-invalid={Boolean(getVisibleError('emailAddress'))}
                    value={emailAddress}
                    onChange={(e) => {
                      setEmailAddress(e.target.value);
                      markTouched('emailAddress');
                    }}
                    onBlur={() => markTouched('emailAddress')}
                    placeholder="e.g. nominee@example.ph"
                    className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:outline-none ${
                      getVisibleError('emailAddress')
                        ? 'border-red-500 focus:border-red-600'
                        : isFieldVerified('emailAddress', emailAddress)
                          ? 'border-emerald-600/60 focus:border-[#08184B]'
                          : 'border-[#08184B]/20 focus:border-[#08184B]'
                    }`}
                  />
                  {getVisibleError('emailAddress') ? (
                    <p data-testid="error-emailAddress" className="mt-1 text-xs text-red-700">
                      {getVisibleError('emailAddress')}
                    </p>
                  ) : isFieldVerified('emailAddress', emailAddress) ? (
                    <p className="no-print mt-1 text-xs text-emerald-700">Verified</p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* • Current Age & Current Work / Profession */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-4">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="nom-age" className="text-sm font-semibold text-[#08184B]">
                    • Current Age: <span className="text-[#A81C1C]">*</span>
                  </label>
                  <span
                    className={`no-print text-[11px] font-mono tabular-nums ${
                      isFieldVerified('currentAge', currentAge)
                        ? 'text-emerald-700 font-semibold'
                        : getVisibleError('currentAge')
                          ? 'text-red-700 font-semibold'
                          : 'text-[#08184B]/60'
                    }`}
                  >
                    10–120
                  </span>
                </div>
                <input
                  id="nom-age"
                  type="number"
                  min={10}
                  max={120}
                  required
                  aria-invalid={Boolean(getVisibleError('currentAge'))}
                  value={currentAge}
                  onChange={(e) => {
                    setCurrentAge(e.target.value);
                    markTouched('currentAge');
                  }}
                  onBlur={() => markTouched('currentAge')}
                  placeholder="e.g. 38"
                  className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg tabular-nums focus:outline-none ${
                    getVisibleError('currentAge')
                      ? 'border-red-500 focus:border-red-600'
                      : isFieldVerified('currentAge', currentAge)
                        ? 'border-emerald-600/60 focus:border-[#08184B]'
                        : 'border-[#08184B]/20 focus:border-[#08184B]'
                  }`}
                />
                {getVisibleError('currentAge') ? (
                  <p data-testid="error-currentAge" className="mt-1 text-xs text-red-700">
                    {getVisibleError('currentAge')}
                  </p>
                ) : isFieldVerified('currentAge', currentAge) ? (
                  <p className="no-print mt-1 text-xs text-emerald-700">Verified</p>
                ) : null}
              </div>

              <div className="sm:col-span-8">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="nom-work" className="text-sm font-semibold text-[#08184B]">
                    • Current Work / Profession: <span className="text-[#A81C1C]">*</span>
                  </label>
                  <span
                    data-testid="count-currentWorkProfession"
                    className={`no-print text-[11px] font-mono tabular-nums ${
                      isFieldVerified('currentWorkProfession', currentWorkProfession)
                        ? 'text-emerald-700 font-semibold'
                        : getVisibleError('currentWorkProfession')
                          ? 'text-red-700 font-semibold'
                          : 'text-[#08184B]/60'
                    }`}
                  >
                    {currentWorkProfession.trim().length} /{' '}
                    {NOMINATION_FIELD_LIMITS.currentWorkProfession.max} chars
                  </span>
                </div>
                <input
                  id="nom-work"
                  type="text"
                  required
                  maxLength={NOMINATION_FIELD_LIMITS.currentWorkProfession.max}
                  aria-invalid={Boolean(getVisibleError('currentWorkProfession'))}
                  value={currentWorkProfession}
                  onChange={(e) => {
                    setCurrentWorkProfession(e.target.value);
                    markTouched('currentWorkProfession');
                  }}
                  onBlur={() => markTouched('currentWorkProfession')}
                  placeholder="e.g. Chief Executive Officer / Educator / Community Leader"
                  className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:outline-none ${
                    getVisibleError('currentWorkProfession')
                      ? 'border-red-500 focus:border-red-600'
                      : isFieldVerified('currentWorkProfession', currentWorkProfession)
                        ? 'border-emerald-600/60 focus:border-[#08184B]'
                        : 'border-[#08184B]/20 focus:border-[#08184B]'
                  }`}
                />
                {getVisibleError('currentWorkProfession') ? (
                  <p data-testid="error-currentWorkProfession" className="mt-1 text-xs text-red-700">
                    {getVisibleError('currentWorkProfession')}
                  </p>
                ) : isFieldVerified('currentWorkProfession', currentWorkProfession) ? (
                  <p className="no-print mt-1 text-xs text-emerald-700">Verified</p>
                ) : null}
              </div>
            </div>

            {/* • Complete Address */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor="nom-address" className="text-sm font-semibold text-[#08184B]">
                  • Complete Address: <span className="text-[#A81C1C]">*</span>
                </label>
                <span
                  data-testid="count-completeAddress"
                  className={`no-print text-[11px] font-mono tabular-nums ${
                    isFieldVerified('completeAddress', completeAddress)
                      ? 'text-emerald-700 font-semibold'
                      : getVisibleError('completeAddress')
                        ? 'text-red-700 font-semibold'
                        : 'text-[#08184B]/60'
                  }`}
                >
                  {completeAddress.trim().length} / {NOMINATION_FIELD_LIMITS.completeAddress.max}{' '}
                  chars
                </span>
              </div>
              <textarea
                id="nom-address"
                rows={2}
                required
                maxLength={NOMINATION_FIELD_LIMITS.completeAddress.max}
                aria-invalid={Boolean(getVisibleError('completeAddress'))}
                value={completeAddress}
                onChange={(e) => {
                  setCompleteAddress(e.target.value);
                  markTouched('completeAddress');
                }}
                onBlur={() => markTouched('completeAddress')}
                placeholder="Street / Barangay, City / Municipality, Province, Postal Code"
                className={`w-full px-4 py-2.5 text-sm bg-white border rounded-lg focus:outline-none ${
                  getVisibleError('completeAddress')
                    ? 'border-red-500 focus:border-red-600'
                    : isFieldVerified('completeAddress', completeAddress)
                      ? 'border-emerald-600/60 focus:border-[#08184B]'
                      : 'border-[#08184B]/20 focus:border-[#08184B]'
                }`}
              />
              {getVisibleError('completeAddress') ? (
                <p data-testid="error-completeAddress" className="mt-1 text-xs text-red-700">
                  {getVisibleError('completeAddress')}
                </p>
              ) : isFieldVerified('completeAddress', completeAddress) ? (
                <p className="no-print mt-1 text-xs text-emerald-700">Verified</p>
              ) : null}
            </div>

            {/* • Curriculum Vitae (CV) or Personal Data Sheet (PDS) */}
            <div className="print-avoid-break bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label htmlFor="nom-cv-file" className="text-sm font-semibold text-[#08184B]">
                  • Curriculum Vitae (CV) or Personal Data Sheet (PDS){' '}
                  <span className="font-normal text-[#08184B]/70">
                    (if available, can be sent to follow once qualified)
                  </span>
                </label>
              </div>

              <div className="no-print flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 hover:border-[#08184B] rounded-lg cursor-pointer">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  <span>{cvUpload ? 'Replace CV / PDS file' : 'Upload CV or PDS (PDF, DOC, Image)'}</span>
                  <input
                    id="nom-cv-file"
                    type="file"
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleCvSelect}
                    className="sr-only"
                  />
                </label>

                {cvUpload && (
                  <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-800">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    <span>{cvUpload.fileName}</span>
                    <button
                      type="button"
                      onClick={() => setCvUpload(null)}
                      aria-label="Remove CV file"
                      className="text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </div>

              <p className="print-only text-xs text-[#08184B]/80">
                Attached CV / PDS:{' '}
                <strong>
                  {cvUpload
                    ? cvUpload.fileName
                    : cvWillFollow
                    ? 'Will be sent to follow once qualified'
                    : 'Not attached'}
                </strong>
              </p>

              <label className="no-print inline-flex items-center gap-2.5 text-xs text-[#08184B]/80 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={cvWillFollow && !cvUpload}
                  disabled={Boolean(cvUpload)}
                  onChange={(e) => setCvWillFollow(e.target.checked)}
                  className="h-4 w-4 accent-[#08184B]"
                />
                <span>CV / PDS will be sent to follow once qualified</span>
              </label>
            </div>
          </div>

          {/* Optional Section */}
          <div className="space-y-5 pt-4 border-t border-[#08184B]/10">
            <h2 className="font-display text-xl font-bold text-[#08184B]">Optional:</h2>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label htmlFor="nom-projects" className="text-sm font-semibold text-[#08184B]">
                  • Major projects, programs, advocacy, or initiatives
                </label>
                <span
                  data-testid="count-majorProjects"
                  className={`no-print text-[11px] font-mono tabular-nums ${
                    getVisibleError('majorProjects')
                      ? 'text-red-700 font-semibold'
                      : 'text-[#08184B]/60'
                  }`}
                >
                  {majorProjects.trim().length} / {NOMINATION_FIELD_LIMITS.majorProjects.max} chars
                </span>
              </div>
              <textarea
                id="nom-projects"
                rows={4}
                maxLength={NOMINATION_FIELD_LIMITS.majorProjects.max}
                aria-invalid={Boolean(getVisibleError('majorProjects'))}
                value={majorProjects}
                onChange={(e) => {
                  setMajorProjects(e.target.value);
                  markTouched('majorProjects');
                }}
                onBlur={() => markTouched('majorProjects')}
                placeholder="Describe notable leadership initiatives, social impact programs, publications, or organizational milestones..."
                className="w-full px-4 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
              />
              {getVisibleError('majorProjects') && (
                <p data-testid="error-majorProjects" className="mt-1 text-xs text-red-700">
                  {getVisibleError('majorProjects')}
                </p>
              )}
            </div>

            <div className="print-avoid-break bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-5 space-y-3">
              <label htmlFor="nom-supporting-files" className="block text-sm font-semibold text-[#08184B]">
                • Supporting documents or proof of accomplishments{' '}
                <span className="font-normal text-[#08184B]/70">(if only available or optional)</span>
              </label>

              <label className="no-print inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 hover:border-[#08184B] rounded-lg cursor-pointer">
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Attach supporting files (up to 5 files)</span>
                <input
                  id="nom-supporting-files"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,image/*"
                  onChange={handleSupportingSelect}
                  className="sr-only"
                />
              </label>

              {supportingUploads.length > 0 ? (
                <ul className="space-y-1.5 pt-1">
                  {supportingUploads.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-xs text-[#08184B]/80">
                      <FileText className="h-3.5 w-3.5 text-[#C89212]" aria-hidden="true" />
                      <span>{f.fileName}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSupportingUploads((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove ${f.fileName}`}
                        className="no-print text-red-700 hover:text-red-900 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="print-only text-xs text-[#08184B]/65">No supporting files attached.</p>
              )}
            </div>
          </div>

          {/* Verbatim IMPORTANT NOTE */}
          <div className="print-avoid-break bg-[#FAF8F4] border border-[#A81C1C]/30 rounded-xl p-5 space-y-1.5">
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-[#A81C1C]">
              IMPORTANT NOTE:
            </p>
            <p className="text-sm text-[#08184B]/90 leading-relaxed font-medium">
              Nomination does not automatically guarantee an award. All nominees should undergo
              evaluation based on the established criteria and the supporting information provided.
            </p>
          </div>

          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="text-sm font-medium text-[#08184B]/70 hover:text-[#08184B] cursor-pointer text-left"
            >
              ← Return to Home
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-7 py-3.5 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {submitting ? 'Submitting Nomination...' : 'Submit Official Nomination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
