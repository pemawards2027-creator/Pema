import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { usePema } from '../context/PemaContext';
import type { PublicPasskeyDevice, UserAccount } from '../types/pema';
import { apiFetch, setUserToken } from '../utils/api';
import {
  deriveBiometricUiState,
  getRememberedBiometricDevice,
  getRememberedEmail,
  mapWebAuthnErrorToFriendlyMessage,
  markBiometricSetupPromptPending,
  setRememberedBiometricDevice,
  setRememberedEmail,
  shouldAutoTriggerBiometricPrompt,
} from '../utils/biometricAuth';

interface AuthPageProps {
  mode: 'signup' | 'login';
  onNavigate: (path: string) => void;
}

interface ServerBiometricStatus {
  email: string;
  hasPasskey: boolean;
  passkeyCount: number;
  deviceLabel: string | null;
}

export function AuthPage({ mode, onNavigate }: AuthPageProps) {
  const { setUser } = usePema();
  const prefersReducedMotion = useReducedMotion();
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const autoPromptedRef = useRef<boolean>(false);
  const enrollRedirectTimerRef = useRef<number | null>(null);

  const [activeMode, setActiveMode] = useState<'signup' | 'login'>(mode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(() => (mode === 'login' ? getRememberedEmail() : ''));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [enrollAfterSignup, setEnrollAfterSignup] = useState(false);
  const [signupEnrollPendingUser, setSignupEnrollPendingUser] = useState<UserAccount | null>(null);
  const [biometricEnrollSuccess, setBiometricEnrollSuccess] = useState<{
    deviceLabel: string;
    email: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricFailed, setBiometricFailed] = useState(false);
  const [passwordPreferred, setPasswordPreferred] = useState(false);
  const [checkingHardware, setCheckingHardware] = useState(true);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [platformSensorReady, setPlatformSensorReady] = useState(false);
  const [serverBiometricStatus, setServerBiometricStatus] =
    useState<ServerBiometricStatus | null>(null);
  const [localBiometricDevice, setLocalBiometricDevice] = useState(() =>
    getRememberedBiometricDevice(),
  );
  const [error, setError] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (enrollRedirectTimerRef.current !== null) {
        window.clearTimeout(enrollRedirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setActiveMode(mode);
    setSignupEnrollPendingUser(null);
    setBiometricEnrollSuccess(null);
    setBiometricFailed(false);
    setPasswordPreferred(false);
    autoPromptedRef.current = false;
    setError(null);
    setStatusNotice(null);
    if (mode === 'login') {
      const remembered = getRememberedEmail();
      if (remembered) setEmail((prev) => prev || remembered);
      setLocalBiometricDevice(getRememberedBiometricDevice());
    }
  }, [mode]);

  useEffect(() => {
    let active = true;
    const supported = browserSupportsWebAuthn();
    setBiometricSupported(supported);
    if (!supported) {
      setPlatformSensorReady(false);
      setCheckingHardware(false);
      return;
    }

    platformAuthenticatorIsAvailable()
      .then((available) => {
        if (!active) return;
        setPlatformSensorReady(available);
        if (available && mode === 'signup') {
          setEnrollAfterSignup(true);
        }
      })
      .catch(() => {
        if (active) setPlatformSensorReady(false);
      })
      .finally(() => {
        if (active) setCheckingHardware(false);
      });

    return () => {
      active = false;
    };
  }, [mode]);

  // Verify with backend whether the current / remembered email already has registered device biometrics
  useEffect(() => {
    if (activeMode !== 'login') {
      setServerBiometricStatus(null);
      return;
    }
    const candidateEmail = email.trim().toLowerCase();
    if (!candidateEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) {
      setServerBiometricStatus(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiFetch<Omit<ServerBiometricStatus, 'email'>>('/api/auth/webauthn/status', {
        method: 'POST',
        body: JSON.stringify({ email: candidateEmail }),
      })
        .then((res) => {
          if (!cancelled) {
            setServerBiometricStatus({ ...res, email: candidateEmail });
          }
        })
        .catch(() => {
          if (!cancelled) setServerBiometricStatus(null);
        });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email, activeMode]);

  const effectiveNormalizedEmail = email.trim().toLowerCase();
  const matchingLocalDevice =
    localBiometricDevice &&
    (!effectiveNormalizedEmail || localBiometricDevice.email === effectiveNormalizedEmail)
      ? localBiometricDevice
      : null;

  const isStatusForCurrentEmail =
    serverBiometricStatus !== null && serverBiometricStatus.email === effectiveNormalizedEmail;

  const hasVerifiedServerPasskey = Boolean(
    isStatusForCurrentEmail && serverBiometricStatus.hasPasskey,
  );

  const isReturningRegistered = Boolean(
    hasVerifiedServerPasskey ||
      (matchingLocalDevice && (!isStatusForCurrentEmail || serverBiometricStatus.hasPasskey)),
  );

  const registeredDeviceLabel =
    (isStatusForCurrentEmail ? serverBiometricStatus.deviceLabel : null) ||
    matchingLocalDevice?.deviceLabel ||
    null;

  const targetDisplayEmail =
    (hasVerifiedServerPasskey ? effectiveNormalizedEmail : null) ||
    matchingLocalDevice?.email ||
    effectiveNormalizedEmail;

  const biometricUi = deriveBiometricUiState({
    supported: biometricSupported,
    checkingHardware,
    platformReady: platformSensorReady,
    isSyncing: biometricLoading,
    isReturningRegistered,
    registeredDeviceLabel,
    targetEmail: targetDisplayEmail,
  });

  const handleUsePasswordInstead = useCallback(() => {
    setPasswordPreferred(true);
    setBiometricFailed(false);
    setError(null);
    passwordInputRef.current?.focus();
    window.setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 40);
  }, []);

  const handleBiometricLogin = useCallback(async () => {
    setError(null);
    setStatusNotice(null);
    setBiometricFailed(false);
    if (!biometricSupported) {
      setBiometricFailed(true);
      setError(
        'This browser does not support WebAuthn Fingerprint/Biometric sign-in. Use Password Instead below or open PEMA in Chrome/Safari on mobile.',
      );
      return;
    }
    setBiometricLoading(true);
    try {
      const lookupEmail = email.trim() || matchingLocalDevice?.email || undefined;
      const { challengeId, options } = await apiFetch<{
        challengeId: string;
        options: Parameters<typeof startAuthentication>[0]['optionsJSON'];
      }>('/api/auth/webauthn/login/options', {
        method: 'POST',
        body: JSON.stringify({
          email: lookupEmail,
        }),
      });

      const assertion = await startAuthentication({ optionsJSON: options });
      const verifiedRes = await apiFetch<{
        token: string;
        user: UserAccount;
        deviceLabel: string;
      }>('/api/auth/webauthn/login/verify', {
        method: 'POST',
        body: JSON.stringify({
          challengeId,
          response: assertion,
          rememberDevice: true,
        }),
      });

      setUserToken(verifiedRes.token);
      setUser(verifiedRes.user);
      setRememberedEmail(verifiedRes.user.email);
      setRememberedBiometricDevice({
        email: verifiedRes.user.email,
        deviceLabel: verifiedRes.deviceLabel || 'Device Biometrics',
        registeredAt: new Date().toISOString(),
      });
      markBiometricSetupPromptPending(false);
      onNavigate('/account');
    } catch (err) {
      setBiometricFailed(true);
      setError(mapWebAuthnErrorToFriendlyMessage(err, 'login'));
    } finally {
      setBiometricLoading(false);
    }
  }, [biometricSupported, email, matchingLocalDevice?.email, onNavigate, setUser]);

  // Automatically prompt returning members for biometrics once on /login when verified credential & sensor are ready
  useEffect(() => {
    if (
      shouldAutoTriggerBiometricPrompt({
        activeMode,
        checkingHardware,
        biometricSupported,
        platformSensorReady,
        hasVerifiedServerPasskey,
        alreadyAutoPrompted: autoPromptedRef.current,
        passwordPreferred,
        biometricLoading,
        loading,
      })
    ) {
      autoPromptedRef.current = true;
      void handleBiometricLogin();
    }
  }, [
    activeMode,
    checkingHardware,
    biometricSupported,
    platformSensorReady,
    hasVerifiedServerPasskey,
    passwordPreferred,
    biometricLoading,
    loading,
    handleBiometricLogin,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusNotice(null);
    setLoading(true);
    try {
      if (activeMode === 'signup') {
        const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ fullName, email, phoneNumber, password, rememberDevice }),
        });
        setUserToken(res.token);
        setUser(res.user);
        if (rememberDevice) {
          setRememberedEmail(res.user.email);
          markBiometricSetupPromptPending(!enrollAfterSignup);
        } else {
          setRememberedEmail(null);
          markBiometricSetupPromptPending(false);
        }

        if (enrollAfterSignup && biometricSupported) {
          setSignupEnrollPendingUser(res.user);
          setStatusNotice(
            'Account created! Complete biometric setup below to sign in passwordlessly with your fingerprint or face unlock next time.',
          );
          return;
        }
        onNavigate('/account');
      } else {
        const res = await apiFetch<{ token: string; user: UserAccount }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, rememberDevice }),
        });
        setUserToken(res.token);
        setUser(res.user);
        if (rememberDevice) {
          setRememberedEmail(res.user.email);
          markBiometricSetupPromptPending(!res.user.hasPasskey);
        } else {
          setRememberedEmail(null);
          markBiometricSetupPromptPending(false);
        }
        onNavigate('/account');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBiometricsAfterSignup = async () => {
    if (!signupEnrollPendingUser) return;
    setError(null);
    setStatusNotice(null);
    if (!biometricSupported) {
      setError('WebAuthn biometric passkeys are not available in this browser.');
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
      setBiometricEnrollSuccess({
        deviceLabel: res.device.deviceLabel,
        email: res.user.email,
      });
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });

      enrollRedirectTimerRef.current = window.setTimeout(() => {
        onNavigate('/account');
      }, 1500);
    } catch (err) {
      setError(mapWebAuthnErrorToFriendlyMessage(err, 'register'));
    } finally {
      setBiometricLoading(false);
    }
  };

  const completeSignupBiometricRedirect = () => {
    if (enrollRedirectTimerRef.current !== null) {
      window.clearTimeout(enrollRedirectTimerRef.current);
      enrollRedirectTimerRef.current = null;
    }
    onNavigate('/account');
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-12">
      {/* Left Royal Navy Brand Showcase */}
      <div className="lg:col-span-5 bg-[#08184B] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <OfficialSealMedallion size="md" />
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D9A726]">
                PEMA · Philippines
              </p>
              <p className="font-display text-xl font-bold">Excellency &amp; Merit Awards</p>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#D9A726]">
              Your place in the story
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight text-balance">
              Step into{' '}
              <em className="italic font-semibold text-[#EAB308]">distinction.</em>
            </h1>
            <p className="text-base text-white/80 leading-relaxed max-w-md">
              Create your PEMA member account to submit official nominations, upload supporting
              credentials, monitor evaluation updates, and download verified payment receipts.
            </p>

            <div className="pt-2 flex items-start gap-3 text-xs text-white/80 bg-white/5 border border-white/10 rounded-xl p-4 max-w-md">
              <Fingerprint className="h-5 w-5 text-[#EAB308] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold text-white">Fingerprint &amp; Face Unlock Passkeys</p>
                <p className="text-white/75 leading-relaxed">
                  Powered by the Web Authentication API (WebAuthn) alongside native browser Save
                  Password so returning members can sign in securely with one tap.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-10 border-t border-white/15 mt-10 flex items-center justify-between text-xs text-white/70">
          <span>Philippine Excellency &amp; Merit Awards</span>
          <button
            type="button"
            onClick={() => onNavigate('/admin')}
            className="inline-flex items-center gap-1.5 text-[#D9A726] hover:text-[#F3D16B] cursor-pointer"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <span>Administrator Access</span>
          </button>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="lg:col-span-7 bg-[#FAF8F4] flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md bg-white border border-[#08184B]/12 rounded-2xl p-7 sm:p-9 space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#A81C1C]">
              {biometricEnrollSuccess
                ? 'Enrollment Complete'
                : signupEnrollPendingUser
                ? 'Step 2 of 2 · Biometric Enrollment'
                : activeMode === 'signup'
                ? 'Join the community'
                : 'Member Portal'}
            </p>
            <h2 className="font-display text-3xl font-bold text-[#08184B]">
              {biometricEnrollSuccess
                ? 'Biometrics registered.'
                : signupEnrollPendingUser
                ? 'Link your Fingerprint or Face Unlock.'
                : activeMode === 'signup'
                ? 'Your next chapter starts here.'
                : 'Welcome back to PEMA.'}
            </h2>
            <p className="text-sm text-[#08184B]/70">
              {biometricEnrollSuccess
                ? `Passwordless biometric sign-in is now active for ${biometricEnrollSuccess.email}.`
                : signupEnrollPendingUser
                ? `Member account ready for ${signupEnrollPendingUser.email}. Register this device for passwordless biometric login.`
                : activeMode === 'signup'
                ? 'Create your account to nominate, follow, and celebrate excellence.'
                : 'Sign in with your saved password or registered device biometrics.'}
            </p>
          </div>

          {/* Animated Checkmark Confirmation when Biometric Registration Succeeds */}
          {biometricEnrollSuccess ? (
            <motion.div
              data-testid="biometric-enroll-success"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl bg-emerald-50/90 border border-emerald-200 p-6 text-center space-y-4"
            >
              <motion.div
                initial={prefersReducedMotion ? false : { scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="mx-auto h-14 w-14 rounded-full bg-emerald-600 text-white flex items-center justify-center"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-7 w-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <motion.path
                    d="M5 13l4 4L19 7"
                    initial={{ pathLength: prefersReducedMotion ? 1 : 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{
                      duration: prefersReducedMotion ? 0 : 0.38,
                      delay: prefersReducedMotion ? 0 : 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                </svg>
              </motion.div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-[#08184B]">
                  {biometricEnrollSuccess.deviceLabel} Linked
                </p>
                <p className="text-xs text-[#08184B]/75">
                  Next time you sign in, you will be prompted automatically to unlock with your
                  fingerprint or face sensor. Redirecting to your Member Account...
                </p>
              </div>

              <button
                type="button"
                data-testid="biometric-success-continue-btn"
                onClick={completeSignupBiometricRedirect}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg transition-colors cursor-pointer"
              >
                <span>Continue to Account Now</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </motion.div>
          ) : (
            <>
              {/* Live Biometric Hardware & Device Security Module Status Indicator */}
              <div
                data-testid="biometric-status-indicator"
                data-biometric-state={biometricUi.state}
                aria-live="polite"
                className={`rounded-xl p-4 space-y-3 transition-colors ${
                  biometricUi.state === 'syncing'
                    ? 'bg-[#08184B] text-white'
                    : biometricUi.state === 'registered'
                    ? 'bg-emerald-50/90 text-[#08184B] border border-emerald-200'
                    : biometricUi.state === 'available'
                    ? 'bg-[#FAF8F4] text-[#08184B] border border-[#D9A726]/45'
                    : 'bg-[#FAF8F4] text-[#08184B]/80 border border-[#08184B]/10'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 mt-0.5">
                    {biometricUi.state === 'syncing' ? (
                      <RefreshCw
                        data-testid="biometric-sync-indicator"
                        className="h-4 w-4 text-[#EAB308] animate-spin"
                        aria-hidden="true"
                      />
                    ) : biometricUi.state === 'checking' ? (
                      <Loader2 className="h-4 w-4 text-[#08184B]/70 animate-spin" aria-hidden="true" />
                    ) : biometricUi.state === 'registered' ? (
                      <CheckCircle2
                        data-testid="biometric-registered-indicator"
                        className="h-4 w-4 text-emerald-700"
                        aria-hidden="true"
                      />
                    ) : biometricUi.state === 'available' ? (
                      <Fingerprint className="h-4 w-4 text-[#A81C1C]" aria-hidden="true" />
                    ) : (
                      <Smartphone className="h-4 w-4 text-[#08184B]/60" aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p
                      className={`text-xs font-semibold ${
                        biometricUi.state === 'syncing' ? 'text-[#EAB308]' : 'text-[#08184B]'
                      }`}
                    >
                      {biometricUi.headline}
                    </p>
                    <p
                      className={`text-xs leading-relaxed ${
                        biometricUi.state === 'syncing' ? 'text-white/85' : 'text-[#08184B]/70'
                      }`}
                    >
                      {biometricUi.detail}
                    </p>
                  </div>
                </div>

                {activeMode === 'login' && !signupEnrollPendingUser && isReturningRegistered && (
                  <div data-testid="returning-biometric-prompt" className="pt-1 space-y-2">
                    <button
                      type="button"
                      data-testid="biometric-login-btn"
                      onClick={handleBiometricLogin}
                      disabled={biometricLoading || loading}
                      className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {biometricLoading ? (
                        <RefreshCw
                          className="h-4 w-4 text-[#EAB308] animate-spin shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <Fingerprint className="h-5 w-5 text-[#EAB308] shrink-0" aria-hidden="true" />
                      )}
                      <span>
                        {biometricLoading
                          ? 'Syncing with Device Security...'
                          : biometricFailed
                          ? 'Retry Fingerprint / Face Unlock'
                          : 'Continue with Fingerprint / Face Unlock'}
                      </span>
                    </button>

                    {!biometricFailed && (
                      <div className="text-center">
                        <button
                          type="button"
                          data-testid="use-password-instead-link"
                          onClick={handleUsePasswordInstead}
                          className={`text-xs font-semibold underline-offset-4 hover:underline cursor-pointer ${
                            biometricUi.state === 'syncing'
                              ? 'text-white/85 hover:text-white'
                              : 'text-[#08184B] hover:text-[#A81C1C]'
                          }`}
                        >
                          Use Password Instead
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {statusNotice && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-900">
                  {statusNotice}
                </div>
              )}

              {error && (
                <div
                  role="alert"
                  className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800 space-y-2"
                >
                  <p>{error}</p>
                  {biometricFailed && activeMode === 'login' && (
                    <button
                      type="button"
                      data-testid="use-password-instead-btn"
                      onClick={handleUsePasswordInstead}
                      className="inline-flex items-center text-xs font-semibold text-[#08184B] underline underline-offset-4 hover:text-[#A81C1C] cursor-pointer"
                    >
                      Use Password Instead →
                    </button>
                  )}
                </div>
              )}

              {signupEnrollPendingUser ? (
                <div data-testid="auth-biometric-enroll-step" className="space-y-4">
                  <button
                    type="button"
                    data-testid="auth-register-biometric-btn"
                    onClick={handleRegisterBiometricsAfterSignup}
                    disabled={biometricLoading}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                  >
                    {biometricLoading ? (
                      <RefreshCw className="h-4 w-4 text-[#EAB308] animate-spin" aria-hidden="true" />
                    ) : (
                      <Fingerprint className="h-5 w-5 text-[#EAB308]" aria-hidden="true" />
                    )}
                    <span>
                      {biometricLoading
                        ? 'Syncing with Device Security Module...'
                        : 'Register Fingerprint / Face Unlock'}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-testid="auth-skip-biometric-btn"
                    onClick={() => onNavigate('/account')}
                    disabled={biometricLoading}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-[#08184B] bg-[#FAF8F4] hover:bg-[#08184B]/5 border border-[#08184B]/15 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Skip &amp; Continue to Account Dashboard</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <>
                  {activeMode === 'login' && (
                    <div className="space-y-3">
                      {!isReturningRegistered && (
                        <button
                          type="button"
                          data-testid="biometric-login-btn"
                          onClick={handleBiometricLogin}
                          disabled={biometricLoading || loading || !biometricSupported}
                          className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-semibold text-[#08184B] bg-[#FAF8F4] hover:bg-[#EAB308]/20 border-2 border-[#D9A726] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {biometricLoading ? (
                            <RefreshCw
                              className="h-4 w-4 text-[#A81C1C] animate-spin shrink-0"
                              aria-hidden="true"
                            />
                          ) : (
                            <Fingerprint className="h-5 w-5 text-[#A81C1C] shrink-0" aria-hidden="true" />
                          )}
                          <span>
                            {biometricLoading
                              ? 'Syncing with Device Security...'
                              : 'Sign in with Fingerprint / Biometrics'}
                          </span>
                        </button>
                      )}

                      <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-[#08184B]/10" />
                        <span className="flex-shrink mx-3 text-[11px] uppercase tracking-wider text-[#08184B]/45 font-medium">
                          or with email &amp; password
                        </span>
                        <div className="flex-grow border-t border-[#08184B]/10" />
                      </div>
                    </div>
                  )}

                  <form method="post" autoComplete="on" onSubmit={handleSubmit} className="space-y-4">
                    {activeMode === 'signup' && (
                      <div>
                        <label
                          htmlFor="auth-fullname"
                          className="block text-sm font-medium text-[#08184B] mb-1.5"
                        >
                          Full name
                        </label>
                        <input
                          id="auth-fullname"
                          name="name"
                          type="text"
                          required
                          autoComplete="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-email"
                        className="block text-sm font-medium text-[#08184B] mb-1.5"
                      >
                        Email address
                      </label>
                      <input
                        id="auth-email"
                        name="email"
                        type="email"
                        required
                        autoComplete={activeMode === 'login' ? 'username webauthn' : 'email'}
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setPasswordPreferred(false);
                        }}
                        placeholder="name@example.com"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                      />
                    </div>

                    {activeMode === 'signup' && (
                      <div>
                        <label
                          htmlFor="auth-phone"
                          className="block text-sm font-medium text-[#08184B] mb-1.5"
                        >
                          Phone number (optional)
                        </label>
                        <input
                          id="auth-phone"
                          name="tel"
                          type="tel"
                          autoComplete="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="09XX-XXX-XXXX"
                          className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-password"
                        className="block text-sm font-medium text-[#08184B] mb-1.5"
                      >
                        Password
                      </label>
                      <input
                        ref={passwordInputRef}
                        id="auth-password"
                        name="password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete={activeMode === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                      />
                    </div>

                    <label className="flex items-start gap-2.5 text-xs text-[#08184B]/80 cursor-pointer select-none pt-0.5">
                      <input
                        type="checkbox"
                        data-testid="remember-device-checkbox"
                        checked={rememberDevice}
                        onChange={(e) => setRememberDevice(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-[#08184B]/30 text-[#08184B] focus:ring-[#08184B] accent-[#08184B] cursor-pointer shrink-0"
                      />
                      <span>
                        <strong className="font-semibold text-[#08184B]">
                          Remember me on this device (30 days)
                        </strong>{' '}
                        — stay signed in automatically and save quick biometric preferences.
                      </span>
                    </label>

                    {activeMode === 'signup' && biometricSupported && (
                      <label className="flex items-start gap-2.5 text-xs text-[#08184B]/80 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          data-testid="signup-enroll-biometric-checkbox"
                          checked={enrollAfterSignup}
                          onChange={(e) => setEnrollAfterSignup(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-[#08184B]/30 text-[#08184B] focus:ring-[#08184B] accent-[#08184B] cursor-pointer shrink-0"
                        />
                        <span>
                          <strong className="font-semibold text-[#08184B]">
                            Link Fingerprint / Face Unlock right after signup
                          </strong>{' '}
                          — set up passwordless WebAuthn passkey login immediately.
                        </span>
                      </label>
                    )}

                    <button
                      type="submit"
                      disabled={loading || biometricLoading}
                      className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
                    >
                      <span>
                        {loading
                          ? 'Please wait...'
                          : activeMode === 'signup'
                          ? 'Create my account'
                          : 'Sign in'}
                      </span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </form>

                  <div className="pt-4 border-t border-[#08184B]/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setStatusNotice(null);
                        setBiometricFailed(false);
                        setPasswordPreferred(false);
                        setActiveMode((m) => (m === 'signup' ? 'login' : 'signup'));
                      }}
                      className="text-[#08184B] font-medium hover:text-[#A81C1C] cursor-pointer text-left"
                    >
                      {activeMode === 'signup'
                        ? 'Already have an account? Sign in'
                        : 'Need an account? Sign up'}
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigate('/nominate')}
                      className="text-[#C89212] font-semibold hover:text-[#08184B] cursor-pointer text-left"
                    >
                      Nomination Form →
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
