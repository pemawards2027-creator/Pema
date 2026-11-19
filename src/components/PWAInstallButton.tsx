import { Check, Copy, Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useState } from 'react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';
import { OfficialSealMedallion } from './BrandMark';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="no-print fixed top-16 left-0 right-0 z-40 bg-[#A81C1C] text-white text-xs font-medium py-2 px-4 flex items-center justify-center gap-2 border-b border-[#D9A726]/40"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>You are currently offline. Viewing cached PEMA portal resources.</span>
    </div>
  );
}

export function PWAInstallButton() {
  const { canNativeInstall, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (canNativeInstall) {
      const result = await install();
      if (result.needsManualGuide) {
        setGuideOpen(true);
      }
      return;
    }
    setGuideOpen(true);
  };

  const handleCopyAppUrl = async () => {
    try {
      const targetUrl = typeof window !== 'undefined' ? window.location.origin : '';
      if (targetUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(targetUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
      }
    } catch {
      // ignore clipboard errors gracefully
    }
  };

  return (
    <>
      {/* Fixed Bottom-Right INSTALL CTA Button */}
      <button
        type="button"
        onClick={handleInstallClick}
        aria-label="Install PEMA App on Android or Desktop"
        data-testid="pwa-install-button"
        className="no-print fixed bottom-5 right-5 z-40 min-h-[46px] inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#08184B] text-white border border-[#D9A726] shadow-lg shadow-[#051034]/30 hover:bg-[#0D2570] transition-colors duration-150 cursor-pointer whitespace-nowrap"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-[#EAB308] text-[#08184B] shrink-0">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="text-xs sm:text-sm font-bold tracking-[0.12em] uppercase">INSTALL</span>
      </button>

      {/* Android / Mobile / Desktop Install Guidance Modal */}
      {guideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Install PEMA Mobile App"
          className="no-print fixed inset-0 z-50 bg-[#051034]/75 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white border border-[#D9A726]/40 rounded-2xl max-w-md w-full p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#08184B]/10 pb-4">
              <div className="flex items-center gap-3.5">
                <OfficialSealMedallion size="sm" />
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                    Installable Web App
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B]">
                    Install PEMA Awards App
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Close install dialog"
                className="p-1.5 text-[#08184B]/60 hover:text-[#08184B] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-[#08184B]/80 leading-relaxed">
              Install the official <strong>Philippine Excellency and Merit Awards</strong> portal
              directly to your Android phone or desktop home screen for full-screen access,
              real-time nomination updates, and offline support.
            </p>

            {isIOS ? (
              <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 space-y-2.5 text-xs text-[#08184B]/85">
                <p className="font-semibold text-[#08184B] flex items-center gap-2">
                  <Share className="h-4 w-4 text-[#C89212]" aria-hidden="true" />
                  <span>Install on iPhone / iPad (Safari)</span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>Tap the <strong>Share</strong> icon in Safari’s toolbar.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Confirm by tapping <strong>Add</strong> in the top-right corner.</li>
                </ol>
              </div>
            ) : (
              <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 space-y-2.5 text-xs text-[#08184B]/85">
                <p className="font-semibold text-[#08184B] flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-[#C89212]" aria-hidden="true" />
                  <span>
                    {isAndroid
                      ? 'Install directly on Android (Chrome)'
                      : 'Install on Android Phone or Desktop Chrome'}
                  </span>
                </p>
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    Open this app URL directly in <strong>Google Chrome</strong> (outside embedded previews).
                  </li>
                  <li>
                    Tap the browser menu <strong>(&#8942;)</strong> or address-bar install icon, then select{' '}
                    <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </li>
                  <li>
                    Tap <strong>Install</strong> to download the PEMA app icon onto your Android device.
                  </li>
                </ol>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleCopyAppUrl}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
              >
                {copiedUrl ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                    <span>App URL Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copy Standalone App URL</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
