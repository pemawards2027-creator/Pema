import { ArrowRight, Check, Info } from 'lucide-react';
import { usePema } from '../context/PemaContext';
import { formatPhpCurrency } from '../utils/pemaRules';

interface PricingPageProps {
  onNavigate: (path: string) => void;
}

export function PricingPage({ onNavigate }: PricingPageProps) {
  const { liveContent } = usePema();
  const pricing = liveContent?.pricing ?? {
    eyebrow: 'Pricing',
    title: 'Your achievement, thoughtfully presented.',
    paragraphs: [
      'Award and program fees are being finalized by the PEMA organizing committee. We’ll publish confirmed rates here as soon as they are approved.',
    ],
    confirmChecklist: 'Confirm award fee · Confirm inclusions · Confirm payment deadline',
  };
  const tiers = liveContent?.settings.pricingTiers ?? [];

  return (
    <div className="bg-[#FAF8F4]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-12">
        <div className="max-w-3xl space-y-5">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
            {pricing.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#08184B] leading-tight text-balance">
            {pricing.title}
          </h1>
          {pricing.paragraphs.map((p, idx) => (
            <p key={idx} className="text-lg text-[#08184B]/80 leading-relaxed">
              {p}
            </p>
          ))}
          <p className="text-sm font-medium text-[#08184B]/65">{pricing.confirmChecklist}</p>
        </div>

        {/* Committee Notice */}
        <div className="bg-white border border-[#D9A726]/40 rounded-2xl p-6 flex items-start gap-4">
          <Info className="h-5 w-5 text-[#C89212] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-sm text-[#08184B]/85">
            <p className="font-semibold text-[#08184B]">
              Official Fee Confirmation &amp; Receipt Issuance
            </p>
            <p>
              {liveContent?.settings.organizationNote ||
                'Program fee, inclusions, payment schedule, and refund terms are finalized by the PEMA Organizing Committee. Verified payments receive an official PEMA receipt inside your Member Account.'}
            </p>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-white border border-[#08184B]/12 rounded-2xl p-8 flex flex-col justify-between space-y-8"
            >
              <div className="space-y-4">
                <p className="text-xs font-medium text-[#08184B]/60">{tier.audience}</p>
                <h2 className="font-display text-2xl font-bold text-[#08184B]">{tier.name}</h2>

                <div className="pt-2 pb-4 border-b border-[#08184B]/10">
                  <p className="font-display text-3xl font-bold text-[#08184B] tabular-nums">
                    {tier.amountPhp !== null ? formatPhpCurrency(tier.amountPhp) : tier.priceLabel}
                  </p>
                  <p className="mt-1 text-xs text-[#A81C1C] font-medium">{tier.statusNote}</p>
                </div>

                <ul className="space-y-3 pt-2">
                  {tier.inclusions.map((inc, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[#08184B]/80">
                      <Check className="h-4 w-4 text-[#C89212] shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('/signup')}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg transition-colors cursor-pointer"
              >
                <span>Register &amp; Reserve Interest</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
