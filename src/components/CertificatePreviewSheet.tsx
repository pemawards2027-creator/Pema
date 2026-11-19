import { Printer } from 'lucide-react';
import type { CertificateTemplateConfig } from '../types/pema';
import { OfficialSealMedallion } from './BrandMark';

interface CertificatePreviewSheetProps {
  template: CertificateTemplateConfig;
  previewImageDataUrl?: string | null;
  showPrintButton?: boolean;
  onPrint?: () => void;
}

export function CertificatePreviewSheet({
  template,
  previewImageDataUrl = null,
  showPrintButton = true,
  onPrint,
}: CertificatePreviewSheetProps) {
  const activeImageUrl = previewImageDataUrl || template.uploadedImageUrl;

  const triggerPrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="space-y-3">
      {showPrintButton && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#08184B]/70">
            {activeImageUrl ? (
              <span>
                Rendering uploaded certificate design{' '}
                <strong>as-is without altering original artwork</strong>{' '}
                {template.showEditableOverlay
                  ? 'with editable honoree fields layered cleanly.'
                  : '(pure uploaded photo print mode).'}
              </span>
            ) : (
              <span>
                Default PEMA framed certificate layout active. Upload a custom design to use your exact photo as template.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={triggerPrint}
            data-testid="print-certificate-btn"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Print / Save Certificate PDF</span>
          </button>
        </div>
      )}

      <div
        data-testid="certificate-preview-sheet"
        className="print-certificate-sheet relative w-full bg-white border border-[#D9A726]/50 rounded-xl overflow-hidden shadow-sm"
      >
        {activeImageUrl ? (
          <div className="relative w-full bg-white">
            {/* Exact uploaded design preserved verbatim with object-contain and zero color/crop modification */}
            <img
              src={activeImageUrl}
              alt={template.templateName || 'Uploaded PEMA Award Certificate Design'}
              className="w-full h-auto max-h-[760px] object-contain block mx-auto"
            />

            {template.showEditableOverlay && (
              <div
                data-testid="certificate-editable-overlay"
                className="pointer-events-none absolute inset-x-[8%] top-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center"
              >
                <div className="bg-white/88 backdrop-blur-[1px] border border-[#D9A726]/55 rounded-xl px-6 py-5 sm:px-10 sm:py-6 shadow-sm max-w-2xl w-full space-y-2">
                  {template.defaultAwardeeName && (
                    <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#08184B] tracking-tight">
                      {template.defaultAwardeeName}
                    </h3>
                  )}
                  {template.defaultProfession && (
                    <p className="text-xs sm:text-sm font-medium text-[#08184B]/80">
                      {template.defaultProfession}
                    </p>
                  )}
                  {template.defaultAwardTitle && (
                    <p className="font-display text-base sm:text-lg font-bold text-[#A81C1C] pt-1">
                      {template.defaultAwardTitle}
                    </p>
                  )}
                  {template.defaultCitationLine && (
                    <p className="text-xs sm:text-sm text-[#08184B]/85 leading-relaxed max-w-xl mx-auto">
                      {template.defaultCitationLine}
                    </p>
                  )}
                  {(template.defaultDateLabel || template.defaultSignatoryLine) && (
                    <div className="pt-2 border-t border-[#D9A726]/35 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#08184B]/75">
                      <span>{template.defaultDateLabel}</span>
                      <span className="font-semibold text-[#08184B]">
                        {template.defaultSignatoryLine}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Default Official PEMA Gold & Navy Framed Certificate when no photo uploaded yet */
          <div className="p-8 sm:p-12 bg-[#FAF8F4] text-center border-8 border-double border-[#D9A726]/70 m-3 rounded-lg space-y-6">
            <div className="flex flex-col items-center gap-3">
              <OfficialSealMedallion size="md" />
              <p className="text-[11px] font-bold tracking-[0.26em] uppercase text-[#A81C1C]">
                Philippine Excellency and Merit Awards
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#08184B] uppercase tracking-wide">
                Certificate of Recognition
              </h2>
            </div>

            <div className="space-y-2 py-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[#08184B]/65">
                Proudly Conferred Upon
              </p>
              <h3 className="font-display text-3xl sm:text-4xl font-bold text-[#08184B]">
                {template.defaultAwardeeName || 'Awardee Complete Name'}
              </h3>
              {template.defaultProfession && (
                <p className="text-sm font-medium text-[#08184B]/75">
                  {template.defaultProfession}
                </p>
              )}
            </div>

            <div className="max-w-2xl mx-auto space-y-2">
              <p className="font-display text-xl font-bold text-[#A81C1C]">
                {template.defaultAwardTitle || 'Official PEMA Award Category'}
              </p>
              <p className="text-sm text-[#08184B]/85 leading-relaxed">
                {template.defaultCitationLine}
              </p>
            </div>

            <div className="pt-6 border-t border-[#D9A726]/40 max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#08184B]/80">
              <div className="text-center sm:text-left">
                <p className="text-[10px] uppercase tracking-widest text-[#08184B]/55">Conferral Date</p>
                <p className="font-semibold text-[#08184B] mt-0.5">{template.defaultDateLabel}</p>
              </div>
              <div className="text-center sm:text-right">
                <p className="text-[10px] uppercase tracking-widest text-[#08184B]/55">Authorized Signatory</p>
                <p className="font-semibold text-[#08184B] mt-0.5">
                  {template.defaultSignatoryLine}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
