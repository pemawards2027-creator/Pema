import { ArrowRight, Award, Check, Globe, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { EditorialSpotlightTabs } from '../components/EditorialSpotlightTabs';
import { usePema } from '../context/PemaContext';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const { liveContent, user } = usePema();
  const [heroImgError, setHeroImgError] = useState(false);

  const hero = liveContent?.hero ?? {
    eyebrow: 'THE STANDARD OF FILIPINO EXCELLENCE',
    headlinePrefix: 'Where distinction',
    headlineEmphasis: 'takes its place.',
    subtitle: 'PEMA honors the people, organizations, and ideas moving the Philippines forward.',
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative min-h-[600px] lg:min-h-[660px] flex items-center bg-[#08184B] text-white overflow-hidden">
        {!heroImgError ? (
          <img
            src="/src/assets/images/hero_manila_gala_1795064556815.jpg"
            alt="Philippine Excellency and Merit Awards Gala Ballroom"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        ) : null}
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#051034]/95 via-[#08184B]/80 to-[#08184B]/55"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-8 space-y-6">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D9A726]">
                {hero.eyebrow}
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[62px] font-bold leading-[1.05] tracking-tight text-balance">
                {hero.headlinePrefix}{' '}
                <em className="italic font-semibold text-[#EAB308]">{hero.headlineEmphasis}</em>
              </h1>

              <p className="text-lg sm:text-xl text-white/85 max-w-xl leading-relaxed">
                {hero.subtitle}
              </p>

              <div className="pt-3 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onNavigate(user ? '/nominate' : '/signup')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  <span>{user ? 'Submit a nomination' : 'Begin your journey'}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('/about')}
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-sm font-semibold text-white border border-white/25 hover:border-[#D9A726] hover:text-[#EAB308] rounded-lg transition-colors duration-150 cursor-pointer whitespace-nowrap"
                >
                  <span>Discover PEMA</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Official PEMA Crest Seal Spotlight */}
            <div className="lg:col-span-4 flex flex-col items-start lg:items-end justify-center">
              <div className="bg-[#051034]/85 backdrop-blur-sm border border-[#D9A726]/40 rounded-2xl p-7 text-center max-w-xs w-full space-y-4">
                <div className="flex justify-center">
                  <OfficialSealMedallion size="lg" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#D9A726]">
                    Official Seal · Philippines
                  </p>
                  <p className="font-display text-xl font-bold text-white">
                    Philippine Excellency &amp; Merit Awards
                  </p>
                  <p className="text-xs text-white/70">
                    2026–2027 Nominations Open
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Editorial 2-Tab Showcase: Headline Template & Highlight of the Month */}
      <EditorialSpotlightTabs onNavigate={onNavigate} />

      {/* Section 2: Mark of Merit */}
      <section className="bg-[#FAF8F4] border-b border-[#08184B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                A Mark of Merit
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#08184B] leading-tight text-balance">
                Recognition that{' '}
                <em className="italic font-semibold text-[#C89212]">means something.</em>
              </h2>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <p className="text-lg text-[#08184B]/80 leading-relaxed max-w-2xl">
                Some achievements deserve more than applause. They deserve a platform, a story, and
                a standard others can aspire to. PEMA brings together accomplished leaders, civic
                pioneers, and forward-thinking institutions under an independent, merit-based
                evaluation framework.
              </p>

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('/services')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#08184B] hover:text-[#A81C1C] transition-colors cursor-pointer"
                >
                  <span>Explore our services</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-hidden="true" className="text-[#08184B]/25">·</span>
                <button
                  type="button"
                  onClick={() => onNavigate('/nominate')}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#08184B] hover:text-[#A81C1C] transition-colors cursor-pointer"
                >
                  <span>View nomination format</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Why PEMA (Asymmetric Showcase) */}
      <section className="bg-white border-b border-[#08184B]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="relative bg-[#08184B] text-white rounded-2xl p-8 sm:p-10 overflow-hidden border border-[#D9A726]/30">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-[0.2em] uppercase text-[#D9A726]">
                      The PEMA Difference
                    </span>
                    <Award className="h-6 w-6 text-[#D9A726]" aria-hidden="true" />
                  </div>
                  <div className="flex justify-center py-4">
                    <OfficialSealMedallion size="md" />
                  </div>
                  <div className="space-y-2 border-t border-white/15 pt-6">
                    <p className="font-display text-2xl font-semibold">
                      Integrity in every citation.
                    </p>
                    <p className="text-sm text-white/75 leading-relaxed">
                      Nomination does not automatically guarantee an award. Every nominee undergoes
                      structured evaluation based on established criteria and verifiable accomplishments.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                Why PEMA
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#08184B] leading-tight text-balance">
                Built for the{' '}
                <em className="italic font-semibold text-[#C89212]">extraordinary.</em>
              </h2>
              <p className="text-base sm:text-lg text-[#08184B]/80 leading-relaxed max-w-2xl">
                From nomination to the moment your name is called, every detail is designed to honor
                the weight of your work.
              </p>

              <ul className="space-y-4 pt-2 border-t border-[#08184B]/10">
                <li className="flex items-start gap-3 pt-2">
                  <Check className="h-5 w-5 text-[#C89212] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#08184B]">Credible recognition</p>
                    <p className="text-sm text-[#08184B]/70">
                      Transparent dossier evaluation guided by CV/PDS credentials and documented outcomes.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-[#C89212] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#08184B]">Meaningful visibility</p>
                    <p className="text-sm text-[#08184B]/70">
                      Editorial profiles and ceremonial presentation highlighting your service and advocacy.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-[#C89212] shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-[#08184B]">A community of achievers</p>
                    <p className="text-sm text-[#08184B]/70">
                      Connect with fellow Filipino innovators, entrepreneurs, educators, and civic builders.
                    </p>
                  </div>
                </li>
              </ul>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/nominate')}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg transition-colors cursor-pointer"
                >
                  <span>Become a nominee</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Closing Call to Action */}
      <section className="bg-[#FAF8F4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center space-y-6">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
            The next name could be yours
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-[#08184B] text-balance mx-auto">
            Make your mark <em className="italic font-semibold text-[#C89212]">count.</em>
          </h2>
          <p className="text-base text-[#08184B]/75 max-w-xl mx-auto">
            Create your PEMA member account to submit an official nomination, track evaluation
            milestones, and access verified payment receipts.
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/signup')}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg transition-colors cursor-pointer"
            >
              <span>Join the PEMA community</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/nominate')}
              className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#08184B] border border-[#08184B]/25 hover:border-[#08184B] bg-white rounded-lg transition-colors cursor-pointer"
            >
              <span>Go to Nomination Form</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
