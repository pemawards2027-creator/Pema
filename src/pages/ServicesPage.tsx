import { ArrowRight } from 'lucide-react';
import { usePema } from '../context/PemaContext';

interface ServicesPageProps {
  onNavigate: (path: string) => void;
}

export function ServicesPage({ onNavigate }: ServicesPageProps) {
  const { liveContent } = usePema();
  const services = liveContent?.services ?? {
    eyebrow: 'Our services',
    title: 'More than an award. A platform.',
    paragraphs: [
      'From a considered nomination experience to a polished awards program, PEMA helps exceptional work receive the attention it deserves.',
      'Our programs are designed to connect achievement with opportunity.',
    ],
    items: [
      {
        number: '01',
        title: 'Nomination support',
        description: 'Clear guidance for presenting the work behind your impact.',
      },
      {
        number: '02',
        title: 'Visibility & storytelling',
        description: 'Thoughtful profiles that help achievements travel further.',
      },
      {
        number: '03',
        title: 'Recognition events',
        description: 'Distinctive moments that bring the PEMA community together.',
      },
    ],
  };

  return (
    <div className="bg-[#FAF8F4]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-14">
        <div className="max-w-3xl space-y-5">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
            {services.eyebrow}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#08184B] leading-tight text-balance">
            {services.title}
          </h1>
          {services.paragraphs.map((p, idx) => (
            <p key={idx} className="text-lg text-[#08184B]/80 leading-relaxed">
              {p}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {services.items.map((item) => (
            <div
              key={item.number}
              className="bg-white border border-[#08184B]/12 rounded-2xl p-8 space-y-4"
            >
              <p className="font-mono text-sm font-semibold text-[#C89212] tabular-nums">
                {item.number}.
              </p>
              <h2 className="font-display text-2xl font-bold text-[#08184B]">{item.title}</h2>
              <p className="text-base text-[#08184B]/75 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="bg-[#08184B] text-white rounded-2xl p-8 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#D9A726]">
              Ready to be evaluated?
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Begin your PEMA nomination dossier today.
            </h2>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/nominate')}
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg transition-colors cursor-pointer"
            >
              <span>Submit nomination</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/signup')}
              className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white border border-white/25 hover:border-[#D9A726] rounded-lg transition-colors cursor-pointer"
            >
              <span>Sign up</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
