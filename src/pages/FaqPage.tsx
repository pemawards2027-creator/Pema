import { ArrowRight, Award, CheckCircle2, ChevronDown, Printer, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EvaluationCriteriaFaqAccordion } from '../components/EvaluationCriteriaFaqAccordion';
import { usePema } from '../context/PemaContext';
import { NOMINATION_CATEGORY_CLUSTERS } from '../utils/pemaRules';

interface FaqPageProps {
  onNavigate: (path: string) => void;
}

type FaqFilterTopic = 'all' | 'faqs' | 'criteria' | 'categories';

const SPONSORSHIP_FAQ = {
  question: 'Is there a sponsorship fee required or is the nomination has a fee?',
  answer:
    'Should the nominee qualify and wish to participate in the awarding ceremony, the applicable participation package and inclusions will be provided for consideration.',
};

export function FaqPage({ onNavigate }: FaqPageProps) {
  const { liveContent } = usePema();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [topicFilter, setTopicFilter] = useState<FaqFilterTopic>('all');

  const baseFaq = liveContent?.faq ?? {
    eyebrow: 'Frequently asked',
    titlePrefix: 'Good questions.',
    titleEmphasis: 'Clear answers.',
    items: [
      {
        number: '01',
        question: 'Who can be nominated?',
        answer:
          'Filipino individuals, professionals, community leaders, entrepreneurs, creatives, and Filipino-led organizations demonstrating measurable merit and lasting societal impact.',
      },
      {
        number: '02',
        question: 'How does the nomination process work?',
        answer:
          'Create a PEMA account and complete the official Nomination Form. All nominees undergo formal evaluation based on established criteria and supporting information.',
      },
      {
        number: '03',
        question: 'When will fees be confirmed?',
        answer:
          'Award and program fees are confirmed by the PEMA Organizing Committee and published on the Pricing page and inside qualified member accounts.',
      },
      {
        number: '04',
        question: 'Can organizations nominate someone else?',
        answer:
          'Yes. Organizations, institutions, and colleagues may submit nominations on behalf of deserving candidates with accurate contact and accomplishment details.',
      },
    ],
  };

  const allFaqItems = useMemo(() => {
    const hasSponsorship = baseFaq.items.some(
      (i) => i.question.toLowerCase() === SPONSORSHIP_FAQ.question.toLowerCase(),
    );
    if (hasSponsorship) return baseFaq.items;
    return [
      ...baseFaq.items,
      {
        number: String(baseFaq.items.length + 1).padStart(2, '0'),
        question: SPONSORSHIP_FAQ.question,
        answer: SPONSORSHIP_FAQ.answer,
      },
    ];
  }, [baseFaq.items]);

  const q = searchQuery.trim().toLowerCase();

  const filteredFaqs = useMemo(() => {
    if (!q) return allFaqItems;
    return allFaqItems.filter(
      (item) =>
        item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q),
    );
  }, [allFaqItems, q]);

  const filteredClusters = useMemo(() => {
    if (!q) return NOMINATION_CATEGORY_CLUSTERS;
    return NOMINATION_CATEGORY_CLUSTERS.filter(
      (cluster) =>
        cluster.clusterTitle.toLowerCase().includes(q) ||
        cluster.awards.some((a) => a.toLowerCase().includes(q)),
    );
  }, [q]);

  const showFaqsSection = topicFilter === 'all' || topicFilter === 'faqs';
  const showCriteriaSection = topicFilter === 'all' || topicFilter === 'criteria';
  const showCategoriesSection = topicFilter === 'all' || topicFilter === 'categories';

  return (
    <div className="bg-[#FAF8F4]">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
              {baseFaq.eyebrow}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#08184B] leading-tight text-balance">
              {baseFaq.titlePrefix}{' '}
              <em className="italic font-semibold text-[#C89212]">{baseFaq.titleEmphasis}</em>
            </h1>
            <p className="text-sm sm:text-base text-[#08184B]/75 max-w-2xl">
              Explore official sponsorship &amp; fee guidelines, the 100% Nomination and Evaluation
              Criteria, and all 8 Philippine Excellency and Merit Awards nomination categories.
            </p>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer self-start md:self-auto shrink-0 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            <span>Print Guide &amp; Criteria</span>
          </button>
        </div>

        {/* Search & Topic Filter Controls */}
        <div className="no-print bg-white border border-[#08184B]/12 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search
                className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter questions, fee policy, criteria weights, or award categories..."
                aria-label="Filter FAQs, evaluation criteria, and award categories"
                data-testid="faq-search-input"
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF8F4] border border-[#08184B]/15 rounded-lg focus:outline-none focus:border-[#08184B]"
              />
            </div>

            <div
              role="tablist"
              aria-label="Filter FAQ topics"
              className="flex flex-wrap items-center gap-1.5"
            >
              {(
                [
                  { id: 'all', label: 'All Topics' },
                  { id: 'faqs', label: 'FAQs & Fees' },
                  { id: 'criteria', label: 'Evaluation Criteria (100%)' },
                  { id: 'categories', label: 'Nomination Categories' },
                ] as Array<{ id: FaqFilterTopic; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={topicFilter === tab.id}
                  onClick={() => setTopicFilter(tab.id)}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    topicFilter === tab.id
                      ? 'bg-[#08184B] text-white'
                      : 'bg-[#FAF8F4] text-[#08184B]/75 hover:text-[#08184B]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        {showFaqsSection && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-[#08184B]">
                Frequently Asked Questions
              </h2>
              <span className="text-xs font-medium text-[#08184B]/60 tabular-nums">
                {filteredFaqs.length} {filteredFaqs.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {filteredFaqs.length === 0 ? (
              <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 text-sm text-[#08184B]/70">
                No FAQ entries match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="divide-y divide-[#08184B]/15 border-y border-[#08184B]/15">
                {filteredFaqs.map((item, idx) => {
                  const isOpen = q ? true : openIndex === idx;
                  return (
                    <div key={item.number + item.question} className="print-avoid-break py-5">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenIndex(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between gap-4 text-left py-2 cursor-pointer group"
                      >
                        <span className="flex items-baseline gap-4">
                          <span className="font-mono text-sm font-semibold text-[#C89212] tabular-nums shrink-0">
                            {item.number}
                          </span>
                          <span className="font-display text-xl sm:text-2xl font-semibold text-[#08184B] group-hover:text-[#A81C1C] transition-colors">
                            {item.question}
                          </span>
                        </span>
                        <ChevronDown
                          className={`no-print h-5 w-5 text-[#08184B]/60 shrink-0 transition-transform duration-150 ${
                            isOpen ? 'rotate-180 text-[#08184B]' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                      {isOpen && (
                        <div className="pl-9 pr-4 pt-2 pb-3 text-base text-[#08184B]/80 leading-relaxed">
                          {item.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Dedicated Nomination and Evaluation Criteria Collapsible Accordion Component */}
        {showCriteriaSection && (
          <EvaluationCriteriaFaqAccordion searchQuery={searchQuery} />
        )}

        {/* PEMA — Nomination Categories */}
        {showCategoriesSection && (
          <div
            data-testid="nomination-categories-section"
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                  2027 Distinctions
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#08184B]">
                  PEMA &mdash; PHILIPPINE EXCELLENCY AND MERIT AWARDS Nomination Categories
                </h2>
                <p className="text-sm text-[#08184B]/75 max-w-3xl">
                  We are pleased to invite nominations for the Philippine Excellency and Merit Awards
                  (PEMA), recognizing individuals who demonstrate excellence, leadership, integrity,
                  and outstanding contributions to their respective fields and communities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/nominate')}
                className="no-print inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg cursor-pointer shrink-0 whitespace-nowrap"
              >
                <Award className="h-4 w-4" aria-hidden="true" />
                <span>Submit Nomination</span>
              </button>
            </div>

            {filteredClusters.length === 0 ? (
              <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 text-sm text-[#08184B]/70">
                No nomination categories match &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filteredClusters.map((cluster, idx) => (
                  <article
                    key={cluster.id}
                    className="print-avoid-break bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-[#08184B]/10 pb-3">
                      <div className="space-y-1">
                        <span className="font-mono text-[11px] font-semibold text-[#C89212] tabular-nums">
                          CLUSTER {String(idx + 1).padStart(2, '0')}
                        </span>
                        <h3 className="font-display text-lg font-bold text-[#08184B] leading-snug">
                          {cluster.clusterTitle}
                        </h3>
                      </div>
                    </div>

                    <ol className="space-y-2.5 text-sm text-[#08184B]/85">
                      {cluster.awards.map((award, aIdx) => (
                        <li key={award} className="flex items-start gap-2.5">
                          <CheckCircle2
                            className="h-4 w-4 text-[#C89212] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>
                            <span className="font-mono text-xs text-[#08184B]/60 mr-1.5">
                              {aIdx + 1}.
                            </span>
                            {award}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="no-print bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="font-semibold text-[#08184B]">Have another question for the Secretariat?</p>
            <p className="text-sm text-[#08184B]/70">
              Reach us at {liveContent?.settings.contactNumber || '0924-173-7587'} or{' '}
              {liveContent?.settings.contactEmail || 'pem.awards2027@gmail.com'}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/contact')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <span>Contact PEMA</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
