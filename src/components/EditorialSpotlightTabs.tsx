import { ArrowRight, Award, Megaphone, Star } from 'lucide-react';
import { useState } from 'react';
import { usePema } from '../context/PemaContext';

interface EditorialSpotlightTabsProps {
  onNavigate: (path: string) => void;
}

export function EditorialSpotlightTabs({ onNavigate }: EditorialSpotlightTabsProps) {
  const { liveContent } = usePema();
  const [activeTab, setActiveTab] = useState<'headline' | 'highlight'>('headline');

  const headline = liveContent?.settings?.headlineTemplate ?? {
    kicker: 'Official PEMA Bulletin',
    headline: '2027 Philippine Excellency & Merit Awards Nominations Now Open',
    subheadline:
      'Submit individual or institutional dossiers for independent committee evaluation across business, public service, culture, and community impact.',
    ctaLabel: 'Submit Nomination',
    ctaPath: '/nominate',
    updatedAt: '',
  };

  const highlight = liveContent?.settings?.highlightOfTheMonth ?? {
    monthLabel: 'November 2026 Highlight',
    title: 'Grassroots Healthcare & Rural Innovation Spotlight',
    honoreeName: 'Dr. Elena M. Villanueva · Lingap Bayan Network',
    category: 'Civic Health & Community Impact',
    summary:
      'Recognized for establishing mobile maternal diagnostics across 32 coastal barangays in Luzon, expanding preventive healthcare access to underserved families.',
    impactNote: 'Over 14,500 community consultations delivered through volunteer medical missions.',
    ctaLabel: 'Explore Nominee Stories',
    ctaPath: '/about',
    updatedAt: '',
  };

  return (
    <section
      aria-label="Headline Bulletin and Highlight of the Month"
      className="bg-white border-b border-[#08184B]/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#08184B]/10 pb-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
              Live PEMA Editorial Board
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#08184B]">
              Official Bulletin &amp; Monthly Spotlight
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Editorial feature tabs"
            className="inline-flex items-center gap-2 bg-[#FAF8F4] p-1.5 rounded-xl border border-[#08184B]/12 self-start md:self-auto"
          >
            <button
              type="button"
              role="tab"
              id="tab-headline-bulletin"
              aria-selected={activeTab === 'headline'}
              aria-controls="panel-headline-bulletin"
              onClick={() => setActiveTab('headline')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'headline'
                  ? 'bg-[#08184B] text-white'
                  : 'text-[#08184B]/75 hover:text-[#08184B]'
              }`}
            >
              <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Headline Template</span>
            </button>

            <button
              type="button"
              role="tab"
              id="tab-highlight-month"
              aria-selected={activeTab === 'highlight'}
              aria-controls="panel-highlight-month"
              onClick={() => setActiveTab('highlight')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'highlight'
                  ? 'bg-[#08184B] text-white'
                  : 'text-[#08184B]/75 hover:text-[#08184B]'
              }`}
            >
              <Star className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Highlight of the Month</span>
            </button>
          </div>
        </div>

        {/* Tab Panel 1: Editable Headline Template */}
        {activeTab === 'headline' && (
          <div
            role="tabpanel"
            id="panel-headline-bulletin"
            aria-labelledby="tab-headline-bulletin"
            className="mt-8 bg-[#08184B] text-white rounded-2xl p-7 sm:p-10 border border-[#D9A726]/35 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div className="lg:col-span-8 space-y-4">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D9A726]">
                {headline.kicker}
              </p>
              <h3 className="font-display text-2xl sm:text-4xl font-bold leading-tight text-balance">
                {headline.headline}
              </h3>
              <p className="text-sm sm:text-base text-white/80 leading-relaxed max-w-2xl">
                {headline.subheadline}
              </p>
            </div>

            <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-between gap-4 border-t lg:border-t-0 lg:border-l border-white/15 pt-5 lg:pt-0 lg:pl-8">
              <button
                type="button"
                onClick={() => onNavigate(headline.ctaPath || '/nominate')}
                className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{headline.ctaLabel || 'Submit Nomination'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              {headline.updatedAt && (
                <p className="text-[11px] text-white/60 tabular-nums">
                  Updated {new Date(headline.updatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Tab Panel 2: Highlight of the Month */}
        {activeTab === 'highlight' && (
          <div
            role="tabpanel"
            id="panel-highlight-month"
            aria-labelledby="tab-highlight-month"
            className="mt-8 bg-[#FAF8F4] rounded-2xl p-7 sm:p-10 border border-[#08184B]/15 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          >
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em]">
                <span className="text-[#A81C1C]">{highlight.monthLabel}</span>
                <span aria-hidden="true" className="text-[#08184B]/25">·</span>
                <span className="text-[#C89212]">{highlight.category}</span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#08184B] leading-tight">
                {highlight.title}
              </h3>

              <p className="text-sm font-semibold text-[#08184B] flex items-center gap-2">
                <Award className="h-4 w-4 text-[#C89212] shrink-0" aria-hidden="true" />
                <span>{highlight.honoreeName}</span>
              </p>

              <p className="text-sm sm:text-base text-[#08184B]/80 leading-relaxed max-w-2xl">
                {highlight.summary}
              </p>
            </div>

            <div className="lg:col-span-4 bg-white border border-[#08184B]/12 rounded-xl p-6 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#08184B]/60">
                Measured Impact
              </p>
              <p className="text-sm font-medium text-[#08184B] leading-relaxed">
                {highlight.impactNote}
              </p>
              <button
                type="button"
                onClick={() => onNavigate(highlight.ctaPath || '/about')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#08184B] hover:text-[#A81C1C] transition-colors cursor-pointer"
              >
                <span>{highlight.ctaLabel || 'Explore Nominee Stories'}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
