import { ArrowRight, Award } from 'lucide-react';
import { useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { usePema } from '../context/PemaContext';

interface GalleryPageProps {
  onNavigate: (path: string) => void;
}

const GALLERY_ITEMS = [
  {
    id: 'gal-1',
    title: 'Grand Gala Ballroom',
    caption: 'Formal evening setting celebrating Filipino leadership and distinction.',
    category: 'Ceremony Venue',
    image: '/src/assets/images/hero_manila_gala_1795064556815.jpg',
  },
  {
    id: 'gal-2',
    title: 'The PEMA Sculpted Trophy',
    caption: '24k gold-finished and optic crystal recognition award.',
    category: 'Award Craft',
    image: '/src/assets/images/gallery_trophy_clean_1795064576318.jpg',
  },
  {
    id: 'gal-3',
    title: 'Awards Presentation Stage',
    caption: 'Bringing together distinguished leaders, innovators, and community builders.',
    category: 'Honoree Stage',
    image: '/src/assets/images/gallery_ceremony_stage_1795064556740.jpg',
  },
];

export function GalleryPage({ onNavigate }: GalleryPageProps) {
  const { liveContent } = usePema();
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const gallery = liveContent?.gallery ?? {
    eyebrow: 'Gallery',
    title: 'Moments with meaning.',
    subtitle: 'A glimpse of the atmosphere we’re building for Filipino excellence.',
  };
  const awardees = liveContent?.awardees ?? [];

  return (
    <div className="bg-[#FAF8F4]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-14">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
              {gallery.eyebrow}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#08184B] leading-tight text-balance">
              {gallery.title}
            </h1>
            <p className="text-lg text-[#08184B]/80 leading-relaxed">{gallery.subtitle}</p>
          </div>

          <div className="flex items-center gap-4">
            <OfficialSealMedallion size="sm" />
            <div className="text-xs text-[#08184B]/70">
              <p className="font-semibold text-[#08184B]">Official PEMA Crest</p>
              <p>2026–2027 Season</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {GALLERY_ITEMS.map((item) => (
            <article
              key={item.id}
              className="bg-white border border-[#08184B]/12 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-[#08184B] relative overflow-hidden">
                {!failedImages[item.id] ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-br from-[#08184B] to-[#051034]">
                    <Award className="h-10 w-10 text-[#D9A726] mb-3" aria-hidden="true" />
                    <p className="font-display text-lg font-semibold">{item.title}</p>
                  </div>
                )}
              </div>
              <div className="p-6 space-y-2">
                <p className="text-xs font-medium text-[#A81C1C]">{item.category}</p>
                <h2 className="font-display text-xl font-bold text-[#08184B]">{item.title}</h2>
                <p className="text-sm text-[#08184B]/75 leading-relaxed">{item.caption}</p>
              </div>
            </article>
          ))}
        </div>

        {/* Live Awardees Photo Album */}
        {awardees.length > 0 && (
          <div className="space-y-6 pt-8 border-t border-[#08184B]/12">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                Honor Roll Photo Album
              </p>
              <h2 className="font-display text-3xl font-bold text-[#08184B]">
                New &amp; Past PEMA Awardees
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {awardees.map((awd) => (
                <article
                  key={awd.id}
                  className="bg-white border border-[#08184B]/12 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-[#08184B] relative overflow-hidden">
                    {!failedImages[awd.id] ? (
                      <img
                        src={awd.photoUrl}
                        alt={`${awd.awardeeName} — ${awd.awardTitle}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [awd.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white bg-gradient-to-br from-[#08184B] to-[#051034]">
                        <Award className="h-10 w-10 text-[#D9A726] mb-3" aria-hidden="true" />
                        <p className="font-display text-lg font-semibold">{awd.awardeeName}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-6 space-y-2">
                    <p className="text-xs font-semibold text-[#A81C1C]">
                      {awd.era} · {awd.yearLabel}
                    </p>
                    <h3 className="font-display text-xl font-bold text-[#08184B]">
                      {awd.awardeeName}
                    </h3>
                    <p className="text-sm font-semibold text-[#C89212]">{awd.awardTitle}</p>
                    <p className="text-sm text-[#08184B]/75">{awd.profession}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 flex justify-center">
          <button
            type="button"
            onClick={() => onNavigate('/nominate')}
            className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg transition-colors cursor-pointer"
          >
            <span>Submit a nomination</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
