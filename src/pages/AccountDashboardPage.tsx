import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Fingerprint,
  LogOut,
  Plus,
  Printer,
  Receipt,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { usePema } from '../context/PemaContext';
import type {
  NominationRecord,
  PaymentRecord,
  PublicPasskeyDevice,
  UserAccount,
} from '../types/pema';
import { apiFetch, fileToPayload } from '../utils/api';
import {
  dismissBiometricSetupPrompt,
  mapWebAuthnErrorToFriendlyMessage,
  markBiometricSetupPromptPending,
  setRememberedBiometricDevice,
  setRememberedEmail,
  shouldPromptBiometricSetup,
} from '../utils/biometricAuth';
import { downloadNominationSummaryPdf } from '../utils/nominationPdf';
import { formatPhpCurrency } from '../utils/pemaRules';

interface AccountDashboardPageProps {
  onNavigate: (path: string) => void;
}

export function AccountDashboardPage({ onNavigate }: AccountDashboardPageProps) {
  const { user, setUser, loadingAuth, logoutUser, liveContent, eventVersion } = usePema();
  const [nominations, setNominations] = useState<NominationRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [passkeyDevices, setPasskeyDevices] = useState<PublicPasskeyDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState<PaymentRecord | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [removingPasskeyId, setRemovingPasskeyId] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [platformSensorReady, setPlatformSensorReady] = useState(false);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [data, passkeyData] = await Promise.all([
        apiFetch<{
          nominations: NominationRecord[];
          payments: PaymentRecord[];
        }>('/api/my/dashboard'),
        apiFetch<{ devices: PublicPasskeyDevice[] }>('/api/auth/passkeys').catch(() => ({
          devices: [],
        })),
      ]);
      setNominations(data.nominations);
      setPayments(data.payments);
      setPasskeyDevices(passkeyData.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load account records.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const supported = browserSupportsWebAuthn();
    setBiometricSupported(supported);
    if (supported) {
      platformAuthenticatorIsAvailable()
        .then((avail) => setPlatformSensorReady(avail))
        .catch(() => setPlatformSensorReady(false));
    }
  }, []);

  useEffect(() => {
    if (!loadingAuth && !user) {
      onNavigate('/login');
      return;
    }
    if (user) {
      loadDashboard();
      setShowBiometricPrompt(shouldPromptBiometricSetup() && !user.hasPasskey);
    }
  }, [user, loadingAuth, loadDashboard, onNavigate, eventVersion]);

  const handleEnableFingerprint = async () => {
    if (!user) return;
    setError(null);
    setNotice(null);

    if (!biometricSupported) {
      setError(
        'Your current browser does not support WebAuthn Fingerprint / Passkey sign-in. Open PEMA in Chrome or Safari on your phone to register biometrics.',
      );
      return;
    }

    setBiometricLoading(true);
    try {
      const { options } = await apiFetch<{
        options: Parameters<typeof startRegistration>[0]['optionsJSON'];
      }>('/api/auth/webauthn/register/options', {
        method: 'POST',
      });

      const attestation = await startRegistration({ optionsJSON: options });
      const res = await apiFetch<{
        verified: boolean;
        user: UserAccount;
        device: PublicPasskeyDevice;
      }>('/api/auth/webauthn/register/verify', {
        method: 'POST',
        body: JSON.stringify({ response: attestation }),
      });

      setUser(res.user);
      setRememberedEmail(res.user.email);
      setRememberedBiometricDevice({
        email: res.user.email,
        deviceLabel: res.device.deviceLabel,
        registeredAt: res.device.createdAt,
      });
      markBiometricSetupPromptPending(false);
      setShowBiometricPrompt(false);
      setPasskeyDevices((prev) => [res.device, ...prev.filter((d) => d.id !== res.device.id)]);
      setNotice(
        `Fingerprint / Biometrics (${res.device.deviceLabel}) enabled and remembered! Next time you sign in, just tap "Sign in with Fingerprint / Biometrics".`,
      );
    } catch (err) {
      setError(mapWebAuthnErrorToFriendlyMessage(err, 'register'));
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleRemovePasskey = async (deviceId: string) => {
    setError(null);
    setNotice(null);
    setRemovingPasskeyId(deviceId);
    try {
      const res = await apiFetch<{ ok: boolean; passkeyCount: number }>(
        `/api/auth/passkeys/${deviceId}`,
        { method: 'DELETE' },
      );
      setPasskeyDevices((prev) => prev.filter((d) => d.id !== deviceId));
      if (res.passkeyCount === 0) {
        setRememberedBiometricDevice(null);
      }
      setUser((prev) =>
        prev
          ? {
              ...prev,
              passkeyCount: res.passkeyCount,
              hasPasskey: res.passkeyCount > 0,
            }
          : prev,
      );
      setNotice('Biometric device removed from your Security Settings.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove passkey.');
    } finally {
      setRemovingPasskeyId(null);
    }
  };

  const handleCvUpload = async (nomId: string, file: File) => {
    setUploadingId(nomId);
    setNotice(null);
    try {
      const payload = await fileToPayload(file);
      await apiFetch(`/api/my/nominations/${nomId}/cv`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setNotice('CV / Personal Data Sheet uploaded to your nomination dossier.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CV upload failed.');
    } finally {
      setUploadingId(null);
    }
  };

  const handleProofUpload = async (payId: string, file: File) => {
    setUploadingId(payId);
    setNotice(null);
    try {
      const payload = await fileToPayload(file);
      await apiFetch(`/api/my/payments/${payId}/proof`, {
        method: 'POST',
        body: JSON.stringify({ ...payload, paymentMethod: 'Uploaded Deposit / Transfer Slip' }),
      });
      setNotice('Payment proof submitted for PEMA Administrator verification.');
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment proof upload failed.');
    } finally {
      setUploadingId(null);
    }
  };

  if (loadingAuth || !user) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-[#08184B]/70">
        Loading your PEMA member account...
      </div>
    );
  }

  return (
    <div className="bg-[#FAF8F4] min-h-[calc(100vh-4rem)] pt-12 pb-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Member Header */}
        <div className="no-print bg-[#08184B] text-white rounded-2xl p-7 sm:p-9 border border-[#D9A726]/35 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5 min-w-0">
            <OfficialSealMedallion size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#D9A726]">
                Member Account
              </p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold break-words">{user.fullName}</h1>
              <p className="text-sm text-white/75 break-all">{user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/nominate')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>New Nomination</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                await logoutUser();
                onNavigate('/');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white border border-white/25 hover:border-white rounded-lg cursor-pointer"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Post-Login "Yes, Enable Fingerprint & Remember" Prompt */}
        {showBiometricPrompt && (
          <div
            data-testid="biometric-setup-prompt"
            className="no-print bg-white border-2 border-[#D9A726] rounded-2xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-[#08184B] text-[#EAB308] flex items-center justify-center shrink-0">
                <Fingerprint className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#A81C1C]">
                  Quick Login Option
                </p>
                <h2 className="font-display text-xl font-bold text-[#08184B]">
                  Use Fingerprint / Biometrics &amp; Remember This Device Next Time?
                </h2>
                <p className="text-sm text-[#08184B]/75 max-w-2xl">
                  Save a biometric Passkey for this phone or computer so you can sign in with your
                  fingerprint instead of typing your password every time.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                data-testid="yes-enable-biometric-btn"
                onClick={handleEnableFingerprint}
                disabled={biometricLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer"
              >
                <Fingerprint className="h-4 w-4 text-[#EAB308]" aria-hidden="true" />
                <span>
                  {biometricLoading
                    ? 'Verify Fingerprint...'
                    : 'Yes, Enable Fingerprint & Remember'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  dismissBiometricSetupPrompt();
                  setShowBiometricPrompt(false);
                }}
                className="px-4 py-2.5 text-sm font-medium text-[#08184B]/70 hover:text-[#08184B] border border-[#08184B]/20 rounded-lg cursor-pointer"
              >
                Not now
              </button>
            </div>
          </div>
        )}

        {notice && (
          <div className="no-print p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div role="alert" className="no-print p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Nominations Section */}
        <section className="no-print space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-[#08184B]">
              My Nominations
            </h2>
            <span className="text-xs font-medium text-[#08184B]/65 tabular-nums">
              {nominations.length} {nominations.length === 1 ? 'submission' : 'submissions'}
            </span>
          </div>

          {loading ? (
            <div className="bg-white border border-[#08184B]/10 rounded-2xl p-8 text-sm text-[#08184B]/60">
              Loading nominations...
            </div>
          ) : nominations.length === 0 ? (
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-8 text-center space-y-3">
              <p className="text-base font-medium text-[#08184B]">No nominations submitted yet.</p>
              <p className="text-sm text-[#08184B]/70 max-w-md mx-auto">
                Complete the official PEMA Nomination Form to enter evaluation for the 2027 Awards.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/nominate')}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
              >
                Submit your nomination
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {nominations.map((nom) => (
                <div
                  key={nom.id}
                  className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-[#08184B]/10 pb-3">
                    <div>
                      <p className="font-mono text-xs text-[#08184B]/60 tabular-nums">
                        {nom.referenceCode}
                      </p>
                      <h3 className="font-display text-xl font-bold text-[#08184B]">
                        {nom.completeName}
                      </h3>
                      <p className="text-xs text-[#08184B]/70">{nom.currentWorkProfession}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/15 px-3 py-1 rounded-md whitespace-nowrap">
                      {nom.status}
                    </span>
                  </div>

                  <div className="text-xs text-[#08184B]/75 space-y-1.5">
                    <p>
                      <strong>Address:</strong> {nom.completeAddress}
                    </p>
                    <p>
                      <strong>Committee Note:</strong> {nom.committeeNotes}
                    </p>
                  </div>

                  <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#08184B]/10">
                    {nom.cvFile ? (
                      <a
                        href={nom.cvFile.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#08184B] hover:text-[#A81C1C]"
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>CV/PDS: {nom.cvFile.fileName}</span>
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#08184B] hover:text-[#A81C1C] cursor-pointer">
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {uploadingId === nom.id
                            ? 'Uploading...'
                            : 'Upload CV / PDS (to follow)'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,image/*"
                          disabled={uploadingId === nom.id}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleCvUpload(nom.id, f);
                          }}
                          className="sr-only"
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      data-testid={`download-nomination-summary-${nom.referenceCode}`}
                      onClick={() => {
                        const filename = downloadNominationSummaryPdf(nom, {
                          contactNumber: liveContent?.settings.contactNumber,
                          contactEmail: liveContent?.settings.contactEmail,
                        });
                        setNotice(`Downloaded "${filename}" PDF summary.`);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#D9A726]/65 hover:bg-[#EAB308] hover:border-[#EAB308] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Download Nomination Summary</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Payments & Official Receipts Section */}
        <section className="no-print space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-[#08184B]">
              Payments &amp; Official Receipts
            </h2>
            <span className="text-xs font-medium text-[#08184B]/65 tabular-nums">
              {payments.length} {payments.length === 1 ? 'record' : 'records'}
            </span>
          </div>

          {payments.length === 0 ? (
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-8 text-sm text-[#08184B]/70">
              No payment statements have been issued for your account yet.
            </div>
          ) : (
            <div className="bg-white border border-[#08184B]/12 rounded-2xl overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="border-b border-[#08184B]/10 text-xs uppercase tracking-wider text-[#08184B]/60 bg-[#FAF8F4]">
                    <th className="py-3.5 px-5 font-semibold">Reference</th>
                    <th className="py-3.5 px-5 font-semibold">Description</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Amount Due</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Amount Paid</th>
                    <th className="py-3.5 px-5 font-semibold">Status</th>
                    <th className="py-3.5 px-5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#08184B]/10 text-sm">
                  {payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-[#FAF8F4]/70">
                      <td className="py-4 px-5 font-mono text-xs font-semibold text-[#08184B] tabular-nums whitespace-nowrap">
                        {pay.receiptReference}
                      </td>
                      <td className="py-4 px-5">
                        <p className="font-medium text-[#08184B]">{pay.description}</p>
                        {pay.adminRemarks && (
                          <p className="text-xs text-[#08184B]/65 mt-0.5">{pay.adminRemarks}</p>
                        )}
                      </td>
                      <td className="py-4 px-5 text-right font-mono text-xs tabular-nums text-[#08184B]">
                        {pay.amountDue > 0 ? formatPhpCurrency(pay.amountDue) : 'To confirm'}
                      </td>
                      <td className="py-4 px-5 text-right font-mono text-xs font-semibold tabular-nums text-[#08184B]">
                        {formatPhpCurrency(pay.amountPaid)}
                      </td>
                      <td className="py-4 px-5">
                        <span
                          className={`text-xs font-semibold ${
                            pay.status === 'Paid / Verified'
                              ? 'text-emerald-800'
                              : pay.status === 'Partial' || pay.status === 'Receipt Uploaded'
                              ? 'text-amber-800'
                              : 'text-[#08184B]/80'
                          }`}
                        >
                          {pay.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right space-x-3 whitespace-nowrap">
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#08184B] hover:text-[#A81C1C] cursor-pointer">
                          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {uploadingId === pay.id ? 'Uploading...' : 'Upload Proof'}
                          </span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            disabled={uploadingId === pay.id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleProofUpload(pay.id, f);
                            }}
                            className="sr-only"
                          />
                        </label>

                        {(pay.officialReceiptFile || pay.status === 'Paid / Verified') && (
                          <button
                            type="button"
                            onClick={() => setReceiptModal(pay)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-md cursor-pointer"
                          >
                            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Official Receipt</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Security Settings Panel: Registered Biometric Devices & Passkey Controls */}
        <section
          id="security-settings"
          data-testid="security-settings-panel"
          aria-labelledby="security-settings-heading"
          className="no-print bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#08184B]/10 pb-5">
            <div className="flex items-start gap-4">
              <div className="h-11 w-11 rounded-xl bg-[#FAF8F4] border border-[#D9A726]/45 text-[#08184B] flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5 text-[#A81C1C]" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#A81C1C]">
                  Account Protection
                </p>
                <h2
                  id="security-settings-heading"
                  className="font-display text-2xl font-bold text-[#08184B]"
                >
                  Security Settings
                </h2>
                <p className="text-sm text-[#08184B]/75">
                  Manage registered biometric devices for passwordless fingerprint or face unlock
                  sign-in on your PEMA account.
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="enable-biometric-btn"
              onClick={handleEnableFingerprint}
              disabled={biometricLoading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Fingerprint className="h-4 w-4 text-[#EAB308]" aria-hidden="true" />
              <span>
                {biometricLoading
                  ? 'Registering biometric device...'
                  : passkeyDevices.length > 0
                  ? 'Add Another Biometric Device'
                  : 'Register Biometric Device'}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-[#08184B]/75">
            <div className="bg-[#FAF8F4] rounded-xl p-4 flex items-start gap-3">
              <Smartphone className="h-4 w-4 text-[#08184B] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[#08184B]">Browser &amp; Phone Compatibility</p>
                <p className="mt-0.5 leading-relaxed">
                  {platformSensorReady
                    ? 'Platform biometric sensor detected on this device.'
                    : 'Works directly on Chrome for Android, Safari iOS, Windows Hello, and installed PEMA Android apps.'}{' '}
                  For native fingerprint prompts on mobile, use a standalone browser tab or the
                  installed PEMA app.
                </p>
              </div>
            </div>

            <div className="bg-[#FAF8F4] rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[#08184B]">Password Fallback Always Active</p>
                <p className="mt-0.5 leading-relaxed">
                  Even with biometric login enabled, you can switch to your saved email password at
                  any time or remove lost devices below.
                </p>
              </div>
            </div>
          </div>

          {passkeyDevices.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#08184B]/65">
                <span className="font-semibold uppercase tracking-wider">
                  Registered Biometric Devices
                </span>
                <span className="tabular-nums font-medium">
                  {passkeyDevices.length} {passkeyDevices.length === 1 ? 'device' : 'devices'}
                </span>
              </div>
              <div className="divide-y divide-[#08184B]/10 border border-[#08184B]/12 rounded-xl overflow-hidden">
                {passkeyDevices.map((dev) => (
                  <div
                    key={dev.id}
                    data-testid={`passkey-device-${dev.id}`}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <Fingerprint className="h-5 w-5 text-[#08184B] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-[#08184B]">{dev.deviceLabel}</p>
                        <p className="text-xs text-[#08184B]/65 tabular-nums">
                          <span>Added {new Date(dev.createdAt).toLocaleDateString()}</span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {dev.backedUp ? 'Synced passkey' : 'Device-bound credential'}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {dev.lastUsedAt
                              ? `Last used ${new Date(dev.lastUsedAt).toLocaleString()}`
                              : 'Ready for biometric sign-in'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      data-testid={`remove-passkey-btn-${dev.id}`}
                      onClick={() => handleRemovePasskey(dev.id)}
                      disabled={removingPasskeyId === dev.id}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#A81C1C] border border-[#A81C1C]/25 hover:bg-red-50 disabled:opacity-55 rounded-lg cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{removingPasskeyId === dev.id ? 'Removing...' : 'Remove Device'}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p
              data-testid="no-biometric-devices-message"
              className="text-xs text-[#08184B]/65"
            >
              No registered biometric devices on your account. Tap{' '}
              <strong>Register Biometric Device</strong> above to link fingerprint or face unlock.
            </p>
          )}
        </section>

        {/* Official Receipt Preview & Print Modal */}
        {receiptModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Official PEMA Payment Receipt"
            className="fixed inset-0 z-50 bg-[#051034]/70 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="bg-white border border-[#D9A726]/40 rounded-2xl max-w-2xl w-full p-7 sm:p-9 space-y-6">
              <div className="no-print flex items-center justify-between border-b border-[#08184B]/10 pb-4">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#08184B]/70">
                  Official PEMA Receipt Document
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceiptModal(null)}
                    aria-label="Close receipt modal"
                    className="p-2 text-[#08184B]/70 hover:text-[#08184B] cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Printable Branded Receipt */}
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 border-b border-[#08184B]/15 pb-5">
                  <div className="flex items-center gap-4">
                    <OfficialSealMedallion size="sm" />
                    <div>
                      <h3 className="font-display text-xl font-bold text-[#08184B]">
                        Philippine Excellency &amp; Merit Awards
                      </h3>
                      <p className="text-xs text-[#08184B]/70">
                        {liveContent?.settings.contactNumber || '0924-173-7587'} ·{' '}
                        {liveContent?.settings.contactEmail || 'pem.awards2027@gmail.com'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase tracking-wider text-[#A81C1C] font-semibold">
                      Official Receipt
                    </p>
                    <p className="font-mono text-sm font-bold text-[#08184B] tabular-nums">
                      {receiptModal.receiptReference}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-[#08184B]/60">Received From</p>
                    <p className="font-semibold text-[#08184B]">{receiptModal.payerName}</p>
                    <p className="text-xs text-[#08184B]/70">{receiptModal.payerEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#08184B]/60">Date &amp; Method</p>
                    <p className="font-semibold text-[#08184B] tabular-nums">
                      {receiptModal.paymentDate || receiptModal.updatedAt.slice(0, 10)}
                    </p>
                    <p className="text-xs text-[#08184B]/70">{receiptModal.paymentMethod}</p>
                  </div>
                </div>

                <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 flex items-center justify-between gap-6">
                  <div>
                    <p className="text-xs text-[#08184B]/60">Particulars</p>
                    <p className="text-sm font-semibold text-[#08184B]">{receiptModal.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[#08184B]/60">Amount Paid</p>
                    <p className="font-mono text-lg font-bold text-[#08184B] tabular-nums whitespace-nowrap">
                      {formatPhpCurrency(receiptModal.amountPaid)}
                    </p>
                  </div>
                </div>

                {receiptModal.officialReceiptFile && (
                  <div className="space-y-2 border-t border-[#08184B]/10 pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#08184B]">
                        Admin-Uploaded Official Receipt Attachment
                      </span>
                      <a
                        href={receiptModal.officialReceiptFile.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[#08184B] font-semibold hover:text-[#A81C1C]"
                      >
                        <span>Open full file</span>
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </div>
                    {receiptModal.officialReceiptFile.mimeType.startsWith('image/') && (
                      <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-3 flex items-center justify-center">
                        <img
                          src={receiptModal.officialReceiptFile.url}
                          alt={`Official receipt ${receiptModal.receiptReference}`}
                          referrerPolicy="no-referrer"
                          className="max-h-72 w-auto rounded-lg object-contain"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
