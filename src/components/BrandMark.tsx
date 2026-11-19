import { Crown } from 'lucide-react';
import { useState } from 'react';
import { usePema } from '../context/PemaContext';

interface BrandMarkProps {
  variant?: 'header' | 'dark' | 'card';
  showSubtitle?: boolean;
}

export function BrandMark({ variant = 'header', showSubtitle = false }: BrandMarkProps) {
  const { logoUrl } = usePema();
  const [imgError, setImgError] = useState(false);
  const isDark = variant === 'dark';

  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap shrink-0">
      <span
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full overflow-hidden border-2 shrink-0 ${
          isDark
            ? 'border-[#D9A726] bg-[#08184B]'
            : 'border-[#D9A726] bg-[#08184B] shadow-xs'
        }`}
      >
        {!imgError ? (
          <img
            src={logoUrl}
            alt="Philippine Excellency and Merit Awards Official Crest"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Crown className="h-5 w-5 text-[#D9A726]" aria-hidden="true" />
        )}
      </span>

      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-lg font-bold tracking-[0.06em] ${
            isDark ? 'text-white' : 'text-[#08184B]'
          }`}
        >
          PEMA
        </span>
        {showSubtitle && (
          <span
            className={`mt-1 text-[10px] font-medium tracking-[0.18em] uppercase ${
              isDark ? 'text-[#D9A726]' : 'text-[#08184B]/70'
            }`}
          >
            Excellency &amp; Merit Awards
          </span>
        )}
      </span>
    </span>
  );
}

export function OfficialSealMedallion({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { logoUrl } = usePema();
  const [imgError, setImgError] = useState(false);

  const dims =
    size === 'lg'
      ? 'h-32 w-32 sm:h-36 sm:w-36'
      : size === 'sm'
      ? 'h-16 w-16'
      : 'h-24 w-24';

  return (
    <div
      className={`relative inline-flex ${dims} items-center justify-center rounded-full p-1 bg-gradient-to-br from-[#F3D16B] via-[#D9A726] to-[#9B6F12] shadow-lg shrink-0`}
    >
      <div className="h-full w-full rounded-full overflow-hidden bg-[#08184B] border-2 border-[#08184B] flex items-center justify-center">
        {!imgError ? (
          <img
            src={logoUrl}
            alt="Official PEMA Seal"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <Crown className="h-1/2 w-1/2 text-[#D9A726]" aria-hidden="true" />
        )}
      </div>
    </div>
  );
}
