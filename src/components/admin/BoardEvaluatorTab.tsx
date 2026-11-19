import { Award, CheckCircle2, ClipboardCheck, FileText, Save, Users } from 'lucide-react';
import { useState } from 'react';
import type {
  AdminDepartmentRole,
  CriteriaScoreBreakdown,
  EvaluatorRecommendation,
  EvaluatorSlot,
  NominationEvaluationScore,
  NominationRecord,
  NominationStatus,
} from '../../types/pema';
import { apiFetch } from '../../utils/api';
import {
  EVALUATOR_SLOTS,
  NOMINATION_EVALUATION_CRITERIA,
  canRoleDecideNomination,
  canRoleScoreEvaluatorSlot,
  computeBoardConsensus,
  isEvaluatorRole,
  normalizeCriteriaScores,
} from '../../utils/pemaRules';

interface BoardEvaluatorTabProps {
  role: AdminDepartmentRole;
  staffName: string;
  nominations: NominationRecord[];
  evaluations: NominationEvaluationScore[];
  onNotifySaved: (detail: string) => void;
  onError: (msg: string) => void;
  onReload: () => Promise<void>;
}

const DEFAULT_BREAKDOWN: CriteriaScoreBreakdown = {
  achievements: 20,
  communityImpact: 20,
  leadership: 16,
  integrity: 12,
  innovation: 8,
  supportingDocs: 4,
};

const CRITERIA_FIELD_MAP: Array<{
  key: keyof CriteriaScoreBreakdown;
  number: number;
  max: number;
}> = [
  { key: 'achievements', number: 1, max: 25 },
  { key: 'communityImpact', number: 2, max: 25 },
  { key: 'leadership', number: 3, max: 20 },
  { key: 'integrity', number: 4, max: 15 },
  { key: 'innovation', number: 5, max: 10 },
  { key: 'supportingDocs', number: 6, max: 5 },
];

export function BoardEvaluatorTab({
  role,
  staffName,
  nominations,
  evaluations,
  onNotifySaved,
  onError,
  onReload,
}: BoardEvaluatorTabProps) {
  const canDecide = canRoleDecideNomination(role);
  const evaluatorSlotForUser: EvaluatorSlot | null = isEvaluatorRole(role) ? role : null;
  const [executiveTargetSlot, setExecutiveTargetSlot] = useState<EvaluatorSlot>('evaluator_1');
  const activeEditableSlot: EvaluatorSlot | null =
    evaluatorSlotForUser ?? (role === 'executive' ? executiveTargetSlot : null);

  const [selectedNomId, setSelectedNomId] = useState<string>(nominations[0]?.id ?? '');
  const activeNom = nominations.find((n) => n.id === selectedNomId) ?? nominations[0] ?? null;

  const existingForActiveSlot = activeNom && activeEditableSlot
    ? evaluations.find(
        (e) => e.nominationId === activeNom.id && e.evaluatorSlot === activeEditableSlot,
      ) ?? null
    : null;

  const [draftScores, setDraftScores] = useState<Record<string, CriteriaScoreBreakdown>>({});
  const [draftRecs, setDraftRecs] = useState<Record<string, EvaluatorRecommendation>>({});
  const [draftRemarks, setDraftRemarks] = useState<Record<string, string>>({});
  const [savingEval, setSavingEval] = useState(false);

  const draftKey = activeNom && activeEditableSlot ? `${activeNom.id}:${activeEditableSlot}` : '';

  const currentBreakdown: CriteriaScoreBreakdown =
    (draftKey && draftScores[draftKey]) ||
    existingForActiveSlot?.criteriaScores ||
    DEFAULT_BREAKDOWN;

  const currentRec: EvaluatorRecommendation =
    (draftKey && draftRecs[draftKey]) ||
    existingForActiveSlot?.recommendation ||
    'Recommend Approval';

  const currentRemarks: string =
    (draftKey && draftRemarks[draftKey] !== undefined
      ? draftRemarks[draftKey]
      : existingForActiveSlot?.remarks) ?? '';

  const { totalScore } = normalizeCriteriaScores(currentBreakdown);

  const setCriterionValue = (key: keyof CriteriaScoreBreakdown, val: number) => {
    if (!draftKey) return;
    setDraftScores((prev) => ({
      ...prev,
      [draftKey]: {
        ...currentBreakdown,
        [key]: val,
      },
    }));
  };

  const handleSaveEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeNom || !activeEditableSlot) return;
    if (!canRoleScoreEvaluatorSlot(role, activeEditableSlot)) return;

    setSavingEval(true);
    onError('');
    try {
      await apiFetch(`/api/admin/evaluations/${activeNom.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          evaluatorSlot: activeEditableSlot,
          evaluatorName: staffName,
          criteriaScores: currentBreakdown,
          recommendation: currentRec,
          remarks: currentRemarks,
        }),
      });
      onNotifySaved(
        `Saved ${activeEditableSlot.replace('_', ' ').toUpperCase()} rubric score (${totalScore}/100%) for ${activeNom.referenceCode}.`,
      );
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save evaluation rubric.');
    } finally {
      setSavingEval(false);
    }
  };

  const handleBoardDecision = async (status: NominationStatus, notes: string) => {
    if (!activeNom || !canDecide) return;
    onError('');
    try {
      await apiFetch(`/api/admin/nominations/${activeNom.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, committeeNotes: notes }),
      });
      onNotifySaved(
        `Board decision "${status}" saved for ${activeNom.completeName} (${activeNom.referenceCode}).`,
      );
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save Board decision.');
    }
  };

  const activeNomEvaluations = activeNom
    ? evaluations.filter((e) => e.nominationId === activeNom.id)
    : [];
  const consensus = computeBoardConsensus(activeNomEvaluations);

  return (
    <div className="space-y-6" data-testid="board-evaluator-workspace">
      {/* Header Role Summary */}
      <div className="bg-white border border-[#D9A726]/45 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
            Committee on Board &amp; 4-Evaluator Screening Panel
          </p>
          <h2 className="font-display text-xl font-bold text-[#08184B]">
            {evaluatorSlotForUser
              ? `${evaluatorSlotForUser.replace('_', ' ').toUpperCase()} — Independent 100% Rubric Scoring`
              : 'Board Deliberation & 4-Evaluator Consensus Matrix'}
          </h2>
          <p className="text-xs text-[#08184B]/70">
            {evaluatorSlotForUser
              ? `You are strictly scoped to submit evaluations for your assigned seat (${evaluatorSlotForUser.replace('_', ' ')}). Final approval belongs to the Committee on Board.`
              : 'Review consolidated scores across Evaluators 1–4 (25%+25%+20%+15%+10%+5% = 100%) and issue final Board decisions.'}
          </p>
        </div>

        {role === 'executive' && (
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="exec-eval-slot" className="text-xs font-semibold text-[#08184B]">
              Score / Audit as:
            </label>
            <select
              id="exec-eval-slot"
              value={executiveTargetSlot}
              onChange={(e) => setExecutiveTargetSlot(e.target.value as EvaluatorSlot)}
              className="px-3 py-2 text-xs font-semibold bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg"
            >
              <option value="evaluator_1">Evaluator 1</option>
              <option value="evaluator_2">Evaluator 2</option>
              <option value="evaluator_3">Evaluator 3</option>
              <option value="evaluator_4">Evaluator 4</option>
            </select>
          </div>
        )}
      </div>

      {nominations.length === 0 ? (
        <div className="bg-white border border-[#08184B]/12 rounded-2xl p-8 text-center text-sm text-[#08184B]/65">
          No nominations awaiting Board or Evaluator review yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Nominee Selector */}
          <div className="xl:col-span-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#08184B]/65 px-1">
              Nomination Dossiers ({nominations.length})
            </p>
            {nominations.map((nom) => {
              const nomEvals = evaluations.filter((e) => e.nominationId === nom.id);
              const cons = computeBoardConsensus(nomEvals);
              const isSelected = activeNom?.id === nom.id;
              return (
                <button
                  key={nom.id}
                  type="button"
                  onClick={() => setSelectedNomId(nom.id)}
                  data-testid={`board-nominee-select-${nom.referenceCode}`}
                  className={`w-full text-left rounded-xl p-4 border cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-[#08184B] text-white border-[#08184B] shadow-xs'
                      : 'bg-white text-[#08184B] border-[#08184B]/12 hover:border-[#08184B]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                    <span className={isSelected ? 'text-[#EAB308] font-bold' : 'text-[#C89212] font-bold'}>
                      {nom.referenceCode}
                    </span>
                    <span className={isSelected ? 'text-white/80' : 'text-[#08184B]/65'}>
                      {cons.submittedCount}/4 Evaluators
                      {cons.averageScore !== null ? ` · Avg ${cons.averageScore}%` : ''}
                    </span>
                  </div>
                  <p className="font-display font-bold text-base leading-snug">{nom.completeName}</p>
                  <p className={`text-xs truncate ${isSelected ? 'text-white/75' : 'text-[#08184B]/70'}`}>
                    {nom.currentWorkProfession} · Status: <strong>{nom.status}</strong>
                  </p>
                </button>
              );
            })}
          </div>

          {/* Right: Active Nominee Dossier + 4-Evaluator Consensus Matrix + Rubric Form */}
          {activeNom && (
            <div className="xl:col-span-8 space-y-6">
              {/* Dossier Details & Supporting Proof */}
              <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#08184B]/10 pb-4">
                  <div className="space-y-1">
                    <p className="font-mono text-xs font-bold text-[#C89212]">
                      {activeNom.referenceCode} · Status: {activeNom.status}
                    </p>
                    <h3 className="font-display text-2xl font-bold text-[#08184B]">
                      {activeNom.completeName}
                    </h3>
                    <p className="text-sm font-medium text-[#08184B]/80">
                      {activeNom.currentWorkProfession} · Age {activeNom.currentAge}
                    </p>
                    <p className="text-xs text-[#08184B]/65">{activeNom.completeAddress}</p>
                  </div>

                  <div className="bg-[#FAF8F4] border border-[#D9A726]/45 rounded-xl px-4 py-3 text-right shrink-0">
                    <p className="text-[10px] uppercase tracking-wider text-[#08184B]/60">
                      Board Panel Average
                    </p>
                    <p className="font-mono text-xl font-bold text-[#08184B] tabular-nums">
                      {consensus.averageScore !== null ? `${consensus.averageScore}%` : 'Pending'}
                    </p>
                    <p className="text-[11px] text-[#08184B]/65 tabular-nums">
                      {consensus.submittedCount} of 4 Evaluators Scored
                    </p>
                  </div>
                </div>

                {activeNom.majorProjects && (
                  <p className="text-sm text-[#08184B]/85 leading-relaxed">
                    <strong className="text-[#08184B]">Projects &amp; Advocacy:</strong>{' '}
                    {activeNom.majorProjects}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {activeNom.cvFile ? (
                    <a
                      href={activeNom.cvFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#08184B] hover:text-[#A81C1C]"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>CV / PDS: {activeNom.cvFile.fileName}</span>
                    </a>
                  ) : (
                    <span className="text-[#08184B]/60">
                      CV / PDS: {activeNom.cvWillFollow ? 'To follow once qualified' : 'Not provided'}
                    </span>
                  )}
                  {activeNom.supportingDocs.map((doc, i) => (
                    <a
                      key={i}
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[#08184B] hover:text-[#A81C1C]"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{doc.fileName}</span>
                    </a>
                  ))}
                </div>

                {/* Final Board Deliberation Actions (Committee on Board & Executive only) */}
                {canDecide && (
                  <div className="pt-3 border-t border-[#08184B]/10 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#08184B] flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-[#C89212]" aria-hidden="true" />
                      Committee on Board Decision ({consensus.recommendApprovalCount}/4 Recommend Approval):
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleBoardDecision(
                            'Approved',
                            `Approved by Committee on Board (${consensus.submittedCount}/4 evaluators; avg ${consensus.averageScore ?? 'N/A'}%).`,
                          )
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                      >
                        Approve &amp; Save
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBoardDecision(
                            'Qualified',
                            `Marked Qualified for Board endorsement (avg ${consensus.averageScore ?? 'N/A'}%).`,
                          )
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/25 hover:border-[#08184B] rounded-lg cursor-pointer"
                      >
                        Mark Qualified
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleBoardDecision(
                            'Rejected',
                            `Not selected by Committee on Board (avg ${consensus.averageScore ?? 'N/A'}%).`,
                          )
                        }
                        className="px-3.5 py-2 text-xs font-semibold text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                      >
                        Reject &amp; Save
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 4-Evaluator Panel Status Matrix */}
              <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-4">
                <h4 className="font-display text-lg font-bold text-[#08184B] flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#C89212]" aria-hidden="true" />
                  <span>4-Evaluator Scorecard Consensus</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {EVALUATOR_SLOTS.map((slot, index) => {
                    const scoreEntry = activeNomEvaluations.find((e) => e.evaluatorSlot === slot);
                    const isOwnSeat = evaluatorSlotForUser === slot;
                    return (
                      <div
                        key={slot}
                        data-testid={`evaluator-card-${slot}`}
                        className={`rounded-xl p-3.5 border space-y-1.5 ${
                          isOwnSeat
                            ? 'bg-[#FAF8F4] border-[#08184B] ring-1 ring-[#08184B]/20'
                            : 'bg-[#FAF8F4] border-[#08184B]/12'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="text-[#08184B]">Evaluator {index + 1}</span>
                          {scoreEntry ? (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-emerald-700"
                              aria-hidden="true"
                            />
                          ) : (
                            <span className="text-[#08184B]/45">Pending</span>
                          )}
                        </div>
                        <p className="font-mono text-lg font-bold text-[#08184B] tabular-nums">
                          {scoreEntry ? `${scoreEntry.totalScore}/100%` : '— / 100%'}
                        </p>
                        <p className="text-[11px] text-[#08184B]/70 truncate">
                          {scoreEntry ? scoreEntry.recommendation : 'Awaiting evaluation'}
                        </p>
                        {scoreEntry?.remarks && (
                          <p className="text-[11px] text-[#08184B]/60 line-clamp-2">
                            &ldquo;{scoreEntry.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Independent Evaluator Rubric Form (Authorized Seat Only) */}
              {activeEditableSlot && (
                <form
                  onSubmit={handleSaveEvaluation}
                  data-testid="evaluator-rubric-form"
                  className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#08184B]/10 pb-3">
                    <div>
                      <h4 className="font-display text-lg font-bold text-[#08184B] flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-[#C89212]" aria-hidden="true" />
                        <span>
                          Submit {activeEditableSlot.replace('_', ' ').toUpperCase()} Scorecard
                        </span>
                      </h4>
                      <p className="text-xs text-[#08184B]/65">
                        Score each official PEMA criterion up to its exact weight limit (Total = 100%).
                      </p>
                    </div>
                    <div className="bg-[#08184B] text-white px-4 py-2 rounded-xl text-right shrink-0">
                      <span className="text-[10px] uppercase tracking-wider text-[#D9A726] block">
                        Computed Total
                      </span>
                      <span
                        data-testid="evaluator-computed-total"
                        className="font-mono text-lg font-bold tabular-nums"
                      >
                        {totalScore} / 100%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {CRITERIA_FIELD_MAP.map((field) => {
                      const meta = NOMINATION_EVALUATION_CRITERIA.find(
                        (c) => c.number === field.number,
                      )!;
                      const val = currentBreakdown[field.key];
                      return (
                        <div
                          key={field.key}
                          className="bg-[#FAF8F4] border border-[#08184B]/10 rounded-xl p-3.5 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label
                              htmlFor={`eval-${field.key}`}
                              className="text-xs font-semibold text-[#08184B]"
                            >
                              {meta.number}. {meta.title}
                            </label>
                            <span className="font-mono text-xs font-bold text-[#A81C1C]">
                              Max {field.max}%
                            </span>
                          </div>
                          <input
                            id={`eval-${field.key}`}
                            data-testid={`eval-input-${field.key}`}
                            type="number"
                            min={0}
                            max={field.max}
                            step="0.5"
                            value={val}
                            onChange={(e) => setCriterionValue(field.key, Number(e.target.value))}
                            className="w-full px-3 py-1.5 text-sm font-mono bg-white border border-[#08184B]/20 rounded-lg"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="eval-recommendation"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Evaluator Recommendation
                      </label>
                      <select
                        id="eval-recommendation"
                        value={currentRec}
                        onChange={(e) =>
                          setDraftRecs((prev) => ({
                            ...prev,
                            [draftKey]: e.target.value as EvaluatorRecommendation,
                          }))
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg bg-white"
                      >
                        <option value="Recommend Approval">Recommend Approval</option>
                        <option value="For Board Deliberation">For Board Deliberation</option>
                        <option value="Not Recommended">Not Recommended</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="eval-remarks"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Evaluator Justification Remarks
                      </label>
                      <input
                        id="eval-remarks"
                        type="text"
                        value={currentRemarks}
                        onChange={(e) =>
                          setDraftRemarks((prev) => ({
                            ...prev,
                            [draftKey]: e.target.value,
                          }))
                        }
                        placeholder="Summarize evidence reviewed and panel observations..."
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2 border-t border-[#08184B]/10">
                    <button
                      type="submit"
                      disabled={savingEval}
                      data-testid="save-evaluation-btn"
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer"
                    >
                      <Save className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {savingEval
                          ? 'Saving...'
                          : `Save ${activeEditableSlot.replace('_', ' ').toUpperCase()} Evaluation`}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
