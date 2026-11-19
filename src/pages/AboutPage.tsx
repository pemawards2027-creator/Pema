import { ArrowRight, RefreshCw } from 'lucide-react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { usePema } from '../context/PemaContext';

interface AboutPageProps {
  onNavigate: (path: string) => void;
}

export function AboutPage({ onNavigate }: AboutPageProps) {
  const { liveContent, refreshLiveContent } = usePema();
  const about = liveContent?.about ?? {
    eyebrow: 'About PEMA',
    title: 'A standard worth reaching for.',
    paragraphs: [
      'PEMA exists to spotlight the Filipinos and Filipino-led organizations whose work creates lasting impact. Our awards are designed as a thoughtful, credible celebration of merit — across business, culture, community, and innovation.',
      'We believe recognition should open doors, strengthen purpose, and inspire the next generation.',
    ],
  };

  return (
    <div className="bg-[#FAF8F4]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
              {about.eyebrow}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#08184B] leading-tight text-balance">
              {about.title}
            </h1>

            <div className="space-y-5 pt-2">
              {about.paragraphs.map((p, idx) => (
                <p key={idx} className="text-lg text-[#08184B]/80 leading-relaxed max-w-2xl">
                  {p}
                </p>
              ))}
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('/signup')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg transition-colors cursor-pointer"
              >
                <span>Create PEMA account</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/nominate')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg transition-colors cursor-pointer"
              >
                <span>Submit nomination</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#08184B] text-white rounded-2xl p-8 border border-[#D9A726]/30 space-y-6">
              <div className="flex items-center gap-4">
                <OfficialSealMedallion size="sm" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#D9A726]">
                    Official Mandate
                  </p>
                  <p className="font-display text-xl font-bold">
                    Philippine Excellency &amp; Merit Awards
                  </p>
                </div>
              </div>

              <div className="space-y-4 border-t border-white/15 pt-5 text-sm text-white/80">
                <div>
                  <p className="font-semibold text-white">Evaluation Integrity</p>
                  <p className="mt-1">
                    Every nomination is reviewed against documented impact, professional standing,
                    and community contribution.
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-white">Confirmed Secretariat</p>
                  <p className="mt-1 tabular-nums">
                    Phone: {liveContent?.settings.contactNumber || '0924-173-7587'} · Email:{' '}
                    {liveContent?.settings.contactEmail || 'pem.awards2027@gmail.com'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/15 flex items-center justify-between text-xs text-white/65">
                <span>
                  {liveContent?.liveSyncOk
                    ? 'Synced live from official portal'
                    : 'Official PEMA baseline'}
                </span>
                <button
                  type="button"
                  onClick={() => refreshLiveContent(true)}
                  className="inline-flex items-center gap-1.5 text-[#D9A726] hover:text-[#F3D16B] cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sync live</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
