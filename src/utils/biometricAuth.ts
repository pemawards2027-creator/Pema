export const PEMA_REMEMBERED_EMAIL_KEY = 'pema_remembered_email';
export const PEMA_BIOMETRIC_PROMPT_KEY = 'pema_prompt_biometric_setup';
export const PEMA_BIOMETRIC_DISMISSED_KEY = 'pema_biometric_dismissed';
export const PEMA_REMEMBERED_BIOMETRIC_KEY = 'pema_remembered_biometric_device';

export interface RememberedBiometricInfo {
  email: string;
  deviceLabel: string;
  registeredAt: string;
}

export type BiometricVisualState =
  | 'checking'
  | 'syncing'
  | 'registered'
  | 'available'
  | 'password_only';

export interface BiometricVisualSummary {
  state: BiometricVisualState;
  headline: string;
  detail: string;
}

export function deriveBiometricUiState(params: {
  supported: boolean;
  checkingHardware: boolean;
  platformReady: boolean;
  isSyncing: boolean;
  isReturningRegistered: boolean;
  registeredDeviceLabel?: string | null;
  targetEmail?: string;
}): BiometricVisualSummary {
  if (params.isSyncing) {
    return {
      state: 'syncing',
      headline: 'Syncing with Device Security Module',
      detail:
        'Communicating with your device fingerprint or face unlock sensor. Complete the prompt on your device to continue.',
    };
  }

  if (params.checkingHardware) {
    return {
      state: 'checking',
      headline: 'Checking Device Biometric Support',
      detail: 'Detecting local WebAuthn platform authenticator and registered passkey status...',
    };
  }

  if (!params.supported) {
    return {
      state: 'password_only',
      headline: 'Biometric Sign-In Unavailable in This Browser',
      detail:
        'Your current browser context does not expose WebAuthn passkeys. Sign in using your email and password below.',
    };
  }

  if (params.isReturningRegistered) {
    const label = params.registeredDeviceLabel || 'Registered Device Biometrics';
    const target = params.targetEmail ? ` for ${params.targetEmail}` : '';
    return {
      state: 'registered',
      headline: `Biometric Login Ready · ${label}`,
      detail: `Previously registered fingerprint or face unlock detected${target}. Tap below for passwordless sign-in.`,
    };
  }

  if (params.platformReady) {
    return {
      state: 'available',
      headline: 'Device Biometrics Available',
      detail:
        'Platform fingerprint or face unlock hardware is active on this device. Sign in once with password to register a passkey.',
    };
  }

  return {
    state: 'password_only',
    headline: 'Standard Password Login Active',
    detail:
      'No built-in platform biometric module was detected here. You can still use saved passwords or attach a passkey in a supported mobile browser tab.',
  };
}

export function shouldAutoTriggerBiometricPrompt(params: {
  activeMode: 'signup' | 'login';
  checkingHardware: boolean;
  biometricSupported: boolean;
  platformSensorReady: boolean;
  hasVerifiedServerPasskey: boolean;
  alreadyAutoPrompted: boolean;
  passwordPreferred: boolean;
  biometricLoading: boolean;
  loading: boolean;
}): boolean {
  return (
    params.activeMode === 'login' &&
    !params.checkingHardware &&
    params.biometricSupported &&
    params.platformSensorReady &&
    params.hasVerifiedServerPasskey &&
    !params.alreadyAutoPrompted &&
    !params.passwordPreferred &&
    !params.biometricLoading &&
    !params.loading
  );
}

export interface WebAuthnRpOriginInput {
  originHeader?: string | string[];
  forwardedProto?: string | string[];
  forwardedHost?: string | string[];
  hostHeader?: string | string[];
  protocol?: string;
}

function firstHeaderValue(val?: string | string[]): string {
  if (!val) return '';
  const raw = Array.isArray(val) ? val[0] : val;
  return raw.split(',')[0].trim();
}

export function resolveWebAuthnRpAndOrigin(input: WebAuthnRpOriginInput): {
  origin: string;
  rpID: string;
} {
  const originHeader = firstHeaderValue(input.originHeader);
  if (originHeader) {
    try {
      const parsed = new URL(originHeader);
      return {
        origin: parsed.origin,
        rpID: parsed.hostname,
      };
    } catch {
      // fall through to host/proto construction
    }
  }

  const forwardedHost = firstHeaderValue(input.forwardedHost);
  const hostHeader = firstHeaderValue(input.hostHeader);
  const host = forwardedHost || hostHeader || 'localhost:3000';

  const forwardedProto = firstHeaderValue(input.forwardedProto);
  const isLocalHost =
    host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('[::1]');
  const proto = forwardedProto || input.protocol || (isLocalHost ? 'http' : 'https');

  const candidateOrigin = `${proto}://${host}`;
  try {
    const parsed = new URL(candidateOrigin);
    return {
      origin: parsed.origin,
      rpID: parsed.hostname,
    };
  } catch {
    return {
      origin: 'http://localhost:3000',
      rpID: 'localhost',
    };
  }
}

export function parsePasskeyDeviceLabel(userAgent?: string | null): string {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'Device Fingerprint / Passkey';
  if (ua.includes('android')) return 'Android Fingerprint / Biometrics';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iPhone / iPad Face ID or Touch ID';
  if (ua.includes('windows')) return 'Windows Hello Biometrics';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'Mac Touch ID / Passkey';
  if (ua.includes('linux')) return 'Linux Platform Passkey';
  return 'Device Fingerprint / Passkey';
}

export function mapWebAuthnErrorToFriendlyMessage(
  err: unknown,
  context: 'register' | 'login',
): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('publickey-credentials') ||
    lower.includes('permissions policy') ||
    lower.includes('identity') ||
    lower.includes('feature is not enabled') ||
    lower.includes('securityerror') ||
    lower.includes('the operation is insecure')
  ) {
    return context === 'register'
      ? 'Biometric registration is restricted inside an embedded preview frame. Open the PEMA portal directly in your mobile browser tab or install it via the INSTALL button to link your device fingerprint.'
      : 'Biometric sign-in is restricted inside an embedded preview frame. Open the PEMA portal in a full browser tab or use the installed PEMA app, or sign in with your saved password.';
  }

  if (lower.includes('notallowederror') || lower.includes('timed out') || lower.includes('not allowed')) {
    return context === 'register'
      ? 'Fingerprint prompt was cancelled or timed out. If you are viewing inside an embedded frame, open PEMA in a standalone browser tab or the installed app and try again.'
      : 'Fingerprint verification was cancelled or timed out. Please try again or use your email and password.';
  }

  if (lower.includes('invalidstateerror') || lower.includes('already exists')) {
    return 'This device fingerprint/passkey is already linked to your PEMA account.';
  }

  return raw || (context === 'register' ? 'Unable to register device biometrics.' : 'Biometric sign-in failed.');
}

export function getRememberedEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(PEMA_REMEMBERED_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export function setRememberedEmail(email: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email && email.trim()) {
      window.localStorage.setItem(PEMA_REMEMBERED_EMAIL_KEY, email.trim().toLowerCase());
    } else {
      window.localStorage.removeItem(PEMA_REMEMBERED_EMAIL_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

export function getRememberedBiometricDevice(): RememberedBiometricInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PEMA_REMEMBERED_BIOMETRIC_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedBiometricInfo>;
    if (parsed && typeof parsed.email === 'string' && parsed.email) {
      return {
        email: parsed.email.toLowerCase(),
        deviceLabel: parsed.deviceLabel || 'Registered Device Biometrics',
        registeredAt: parsed.registeredAt || '',
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function setRememberedBiometricDevice(info: RememberedBiometricInfo | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (info && info.email.trim()) {
      window.localStorage.setItem(
        PEMA_REMEMBERED_BIOMETRIC_KEY,
        JSON.stringify({
          email: info.email.trim().toLowerCase(),
          deviceLabel: info.deviceLabel || 'Registered Device Biometrics',
          registeredAt: info.registeredAt || new Date().toISOString(),
        }),
      );
    } else {
      window.localStorage.removeItem(PEMA_REMEMBERED_BIOMETRIC_KEY);
    }
  } catch {
    // ignore
  }
}

export function shouldPromptBiometricSetup(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      window.localStorage.getItem(PEMA_BIOMETRIC_PROMPT_KEY) === '1' &&
      window.localStorage.getItem(PEMA_BIOMETRIC_DISMISSED_KEY) !== '1'
    );
  } catch {
    return false;
  }
}

export function markBiometricSetupPromptPending(pending: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (pending) {
      window.localStorage.setItem(PEMA_BIOMETRIC_PROMPT_KEY, '1');
      window.localStorage.removeItem(PEMA_BIOMETRIC_DISMISSED_KEY);
    } else {
      window.localStorage.removeItem(PEMA_BIOMETRIC_PROMPT_KEY);
    }
  } catch {
    // ignore
  }
}

export function dismissBiometricSetupPrompt(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PEMA_BIOMETRIC_PROMPT_KEY);
    window.localStorage.setItem(PEMA_BIOMETRIC_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
}
