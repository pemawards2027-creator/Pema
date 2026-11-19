import { ChevronDown, ChevronsDownUp, ChevronsUpDown, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { NOMINATION_EVALUATION_CRITERIA, type EvaluationCriterion } from '../utils/pemaRules';

interface EvaluationCriteriaFaqAccordionProps {
  searchQuery?: string;
}

const CRITERION_GUIDANCE: Record<number, string> = {
  1: 'Reviewed through career milestones, official citations, awards received, project outcomes, and verifiable leadership track records.',
  2: 'Assessed on direct benefits to communities, marginalized groups, civic institutions, or measurable national/local upliftment.',
  3: 'Evaluates organizational stewardship, spearheading transformative initiatives, mentorship, and mobilizing collaborative teams.',
  4: 'Verifies good moral standing, public accountability, compliance, and ethical professional reputation across peers and stakeholders.',
  5: 'Scores original programs, process improvements, modern service delivery, or pioneering methods introduced by the nominee.',
  6: 'Requires verifiable evidence such as Curriculum Vitae / Personal Data Sheet, certificates, commendations, photos, or published press.',
};

export function EvaluationCriteriaFaqAccordion({
  searchQuery = '',
}: EvaluationCriteriaFaqAccordionProps) {
  const [openNumbers, setOpenNumbers] = useState<number[]>([1]);

  const q = searchQuery.trim().toLowerCase();

  const filteredCriteria: EvaluationCriterion[] = useMemo(() => {
    if (!q) return NOMINATION_EVALUATION_CRITERIA;
    return NOMINATION_EVALUATION_CRITERIA.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        (CRITERION_GUIDANCE[c.number] ?? '').toLowerCase().includes(q) ||
        `${c.weightPercent}%`.includes(q),
    );
  }, [q]);

  useEffect(() => {
    if (q && filteredCriteria.length > 0) {
      setOpenNumbers(filteredCriteria.map((c) => c.number));
    }
  }, [q, filteredCriteria]);

  const toggleItem = (num: number) => {
    setOpenNumbers((prev) =>
      prev.includes(num) ? prev.filter((item) => item !== num) : [...prev, num],
    );
  };

  const allExpanded =
    filteredCriteria.length > 0 && filteredCriteria.every((c) => openNumbers.includes(c.number));

  const handleToggleAll = () => {
    if (allExpanded) {
      setOpenNumbers([]);
    } else {
      setOpenNumbers(filteredCriteria.map((c) => c.number));
    }
  };

  return (
    <section
      data-testid="evaluation-criteria-section"
      aria-labelledby="evaluation-criteria-heading"
      className="print-avoid-break bg-white border border-[#D9A726]/45 rounded-2xl p-6 sm:p-9 space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#08184B]/10 pb-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
            Official Screening &amp; Scoring Framework
          </p>
          <h2
            id="evaluation-criteria-heading"
            className="font-display text-2xl sm:text-3xl font-bold text-[#08184B]"
          >
            NOMINATION AND EVALUATION CRITERIA
          </h2>
          <p className="text-sm text-[#08184B]/70">
            Expand each criterion below to inspect its exact percentage weight and evaluation scope.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          {filteredCriteria.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              data-testid="criteria-toggle-all-btn"
              className="no-print inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer whitespace-nowrap"
            >
              {allExpanded ? (
                <>
                  <ChevronsDownUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronsUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Expand All</span>
                </>
              )}
            </button>
          )}
          <div className="bg-[#08184B] text-white px-4 py-2 rounded-xl text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-[#D9A726]">Total</p>
            <p className="font-mono text-lg font-bold tabular-nums leading-tight">100%</p>
          </div>
        </div>
      </div>

      {filteredCriteria.length === 0 ? (
        <p className="text-sm text-[#08184B]/70">
          No evaluation criteria match &ldquo;{searchQuery}&rdquo;.
        </p>
      ) : (
        <div className="divide-y divide-[#08184B]/12 border-y border-[#08184B]/12">
          {filteredCriteria.map((criterion) => {
            const isOpen = openNumbers.includes(criterion.number);
            const guidance = CRITERION_GUIDANCE[criterion.number];
            return (
              <div
                key={criterion.number}
                data-testid={`criteria-accordion-item-${criterion.number}`}
                className="print-avoid-break py-3.5"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`criteria-panel-${criterion.number}`}
                  onClick={() => toggleItem(criterion.number)}
                  className="w-full flex items-center justify-between gap-4 py-2 text-left cursor-pointer group"
                >
                  <span className="flex items-center gap-3.5 min-w-0">
                    <span className="h-8 w-8 rounded-lg bg-[#FAF8F4] border border-[#D9A726]/45 font-mono text-xs font-bold text-[#08184B] flex items-center justify-center shrink-0 tabular-nums">
                      0{criterion.number}
                    </span>
                    <span className="font-display text-lg sm:text-xl font-bold text-[#08184B] group-hover:text-[#A81C1C] leading-snug">
                      {criterion.number}. {criterion.title}
                    </span>
                  </span>

                  <span className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs sm:text-sm font-bold text-[#A81C1C] bg-[#FAF8F4] border border-[#D9A726]/55 px-2.5 py-1 rounded-lg tabular-nums">
                      {criterion.weightPercent}%
                    </span>
                    <ChevronDown
                      className={`no-print h-5 w-5 text-[#08184B]/60 transition-transform duration-150 ${
                        isOpen ? 'rotate-180 text-[#08184B]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={`criteria-panel-${criterion.number}`}
                    className="pl-11 pr-2 pt-2 pb-3 space-y-3"
                  >
                    <p className="text-sm sm:text-base text-[#08184B]/85 leading-relaxed">
                      {criterion.description}
                    </p>

                    {guidance && (
                      <div className="bg-[#FAF8F4] border border-[#08184B]/10 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-[#08184B]/75 leading-relaxed">
                        <ShieldCheck
                          className="h-4 w-4 text-[#C89212] shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span>
                          <strong className="text-[#08184B]">Panel Screening Focus:</strong>{' '}
                          {guidance}
                        </span>
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-mono text-[#08184B]/65">
                        <span>Scoring Weight Share</span>
                        <span className="font-semibold text-[#08184B] tabular-nums">
                          {criterion.weightPercent} of 100 points
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#08184B]/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#C89212] rounded-full"
                          style={{ width: `${criterion.weightPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#08184B]/80">
        <span>
          <strong>TOTAL WEIGHTED EVALUATION:</strong> 25% + 25% + 20% + 15% + 10% + 5%
        </span>
        <span className="font-mono font-bold text-[#08184B] text-sm tabular-nums">
          TOTAL: 100%
        </span>
      </div>
    </section>
  );
}
