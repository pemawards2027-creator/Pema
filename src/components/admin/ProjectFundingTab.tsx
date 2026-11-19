import { CheckCircle2, Coins, Pencil, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type {
  AdminDepartmentRole,
  ProjectFundingRecord,
  ProjectFundingStatus,
  ProjectFundingType,
} from '../../types/pema';
import { apiFetch } from '../../utils/api';
import {
  canRoleClearFundingFinance,
  canRoleMutateFunding,
  computeFundingSummary,
  formatPhpCurrency,
} from '../../utils/pemaRules';

interface ProjectFundingTabProps {
  role: AdminDepartmentRole;
  records: ProjectFundingRecord[];
  onNotifySaved: (detail: string) => void;
  onError: (msg: string) => void;
  onReload: () => Promise<void>;
}

export function ProjectFundingTab({
  role,
  records,
  onNotifySaved,
  onError,
  onReload,
}: ProjectFundingTabProps) {
  const canMutate = canRoleMutateFunding(role);
  const canClearFinance = canRoleClearFundingFinance(role);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sourceOrSponsor, setSourceOrSponsor] = useState('');
  const [fundingType, setFundingType] = useState<ProjectFundingType>('Ceremony Sponsorship');
  const [targetAmountPhp, setTargetAmountPhp] = useState('250000');
  const [committedAmountPhp, setCommittedAmountPhp] = useState('0');
  const [disbursedAmountPhp, setDisbursedAmountPhp] = useState('0');
  const [status, setStatus] = useState<ProjectFundingStatus>('Proposed');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const summary = computeFundingSummary(records);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSourceOrSponsor('');
    setFundingType('Ceremony Sponsorship');
    setTargetAmountPhp('250000');
    setCommittedAmountPhp('0');
    setDisbursedAmountPhp('0');
    setStatus('Proposed');
    setNotes('');
  };

  const startEdit = (item: ProjectFundingRecord) => {
    setEditingId(item.id);
    setTitle(item.title);
    setSourceOrSponsor(item.sourceOrSponsor);
    setFundingType(item.fundingType);
    setTargetAmountPhp(String(item.targetAmountPhp));
    setCommittedAmountPhp(String(item.committedAmountPhp));
    setDisbursedAmountPhp(String(item.disbursedAmountPhp));
    setStatus(item.status);
    setNotes(item.notes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canMutate) return;
    setSaving(true);
    onError('');
    try {
      const payload = {
        title,
        sourceOrSponsor,
        fundingType,
        targetAmountPhp: Number(targetAmountPhp),
        committedAmountPhp: Number(committedAmountPhp),
        disbursedAmountPhp: Number(disbursedAmountPhp),
        status,
        notes,
      };
      if (editingId) {
        await apiFetch(`/api/admin/funding/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        onNotifySaved(`Updated project funding initiative "${title}".`);
      } else {
        await apiFetch('/api/admin/funding', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onNotifySaved(`Saved new project funding initiative "${title}".`);
      }
      resetForm();
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save project funding record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ProjectFundingRecord) => {
    if (!canMutate) return;
    onError('');
    try {
      await apiFetch(`/api/admin/funding/${item.id}`, { method: 'DELETE' });
      if (editingId === item.id) resetForm();
      onNotifySaved(`Removed project funding record ${item.programCode}.`);
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete funding record.');
    }
  };

  const handleToggleFinanceClearance = async (item: ProjectFundingRecord) => {
    if (!canClearFinance) return;
    onError('');
    const nextClearance =
      item.financeClearanceStatus === 'Finance Verified'
        ? 'Pending Finance Review'
        : 'Finance Verified';
    try {
      await apiFetch(`/api/admin/funding/${item.id}/finance-clearance`, {
        method: 'PATCH',
        body: JSON.stringify({ financeClearanceStatus: nextClearance }),
      });
      onNotifySaved(
        `Treasury clearance updated to "${nextClearance}" for ${item.programCode}.`,
      );
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to update finance clearance.');
    }
  };

  return (
    <div className="space-y-6" data-testid="project-funding-workspace">
      {/* Departmental Role Boundary Banner */}
      <div className="bg-white border border-[#D9A726]/45 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
            PEMA Project Funding Department
          </p>
          <h2 className="font-display text-xl font-bold text-[#08184B]">
            Sponsorships, Grants &amp; Ceremonial Production Budget Ledger
          </h2>
          <p className="text-xs text-[#08184B]/70">
            {canMutate
              ? 'Full funding program management active. Disbursed allocations are audited by Official Finance Treasury Clearance.'
              : 'Official Finance Treasury View: Verify and grant Finance Clearance for funding disbursements (only Funding Dept or Executive Admin can edit funding goals).'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
          <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl px-3.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#08184B]/60">Target</p>
            <p className="font-mono text-xs sm:text-sm font-bold text-[#08184B] tabular-nums">
              {formatPhpCurrency(summary.totalTargetPhp)}
            </p>
          </div>
          <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl px-3.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#08184B]/60">Committed</p>
            <p className="font-mono text-xs sm:text-sm font-bold text-emerald-800 tabular-nums">
              {formatPhpCurrency(summary.totalCommittedPhp)}
            </p>
          </div>
          <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl px-3.5 py-2 col-span-2 sm:col-span-1">
            <p className="text-[10px] uppercase tracking-wider text-[#08184B]/60">Disbursed</p>
            <p className="font-mono text-xs sm:text-sm font-bold text-[#A81C1C] tabular-nums">
              {formatPhpCurrency(summary.totalDisbursedPhp)}
            </p>
          </div>
        </div>
      </div>

      {/* Create / Edit Funding Form (Funding Dept & Executive only) */}
      {canMutate && (
        <form
          onSubmit={handleSubmit}
          data-testid="project-funding-form"
          className="bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-[#08184B]/10 pb-3">
            <h3 className="font-display text-lg font-bold text-[#08184B] flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#C89212]" aria-hidden="true" />
              <span>
                {editingId
                  ? 'Update Project Funding Initiative'
                  : 'Register New Project Funding / Sponsorship'}
              </span>
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-semibold text-[#08184B]/70 hover:text-[#08184B] cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="fund-title" className="block text-xs font-semibold text-[#08184B] mb-1">
                Initiative / Project Title *
              </label>
              <input
                id="fund-title"
                data-testid="funding-title-input"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Regional Nominee Travel & Broadcast Grant"
                className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="fund-sponsor" className="block text-xs font-semibold text-[#08184B] mb-1">
                Sponsor / Institutional Funding Source *
              </label>
              <input
                id="fund-sponsor"
                data-testid="funding-sponsor-input"
                type="text"
                required
                value={sourceOrSponsor}
                onChange={(e) => setSourceOrSponsor(e.target.value)}
                placeholder="e.g., Luzon Civic Chamber Partnership"
                className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
              />
            </div>

            <div>
              <label htmlFor="fund-type" className="block text-xs font-semibold text-[#08184B] mb-1">
                Allocation Classification
              </label>
              <select
                id="fund-type"
                value={fundingType}
                onChange={(e) => setFundingType(e.target.value as ProjectFundingType)}
                className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg bg-white"
              >
                <option value="Ceremony Sponsorship">Ceremony Sponsorship</option>
                <option value="Institutional Grant">Institutional Grant</option>
                <option value="Patronage Fund">Patronage Fund</option>
                <option value="Production Allocation">Production Allocation</option>
              </select>
            </div>

            <div>
              <label htmlFor="fund-status" className="block text-xs font-semibold text-[#08184B] mb-1">
                Funding Milestone Status
              </label>
              <select
                id="fund-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectFundingStatus)}
                className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg bg-white"
              >
                <option value="Proposed">Proposed</option>
                <option value="Active Pledge">Active Pledge</option>
                <option value="Partially Disbursed">Partially Disbursed</option>
                <option value="Fully Funded">Fully Funded</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <div>
                <label htmlFor="fund-target" className="block text-xs font-semibold text-[#08184B] mb-1">
                  Target (PHP)
                </label>
                <input
                  id="fund-target"
                  type="number"
                  min={0}
                  step="0.01"
                  value={targetAmountPhp}
                  onChange={(e) => setTargetAmountPhp(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="fund-committed" className="block text-xs font-semibold text-[#08184B] mb-1">
                  Committed (PHP)
                </label>
                <input
                  id="fund-committed"
                  type="number"
                  min={0}
                  step="0.01"
                  value={committedAmountPhp}
                  onChange={(e) => setCommittedAmountPhp(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="fund-disbursed" className="block text-xs font-semibold text-[#08184B] mb-1">
                  Disbursed (PHP)
                </label>
                <input
                  id="fund-disbursed"
                  type="number"
                  min={0}
                  step="0.01"
                  value={disbursedAmountPhp}
                  onChange={(e) => setDisbursedAmountPhp(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="fund-notes" className="block text-xs font-semibold text-[#08184B] mb-1">
              Allocation Scope &amp; Budget Remarks
            </label>
            <textarea
              id="fund-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Specify purpose, deliverables, or tranche schedule..."
              className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#08184B]/10">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={saving}
              data-testid="save-funding-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Save Funding Changes'
                    : 'Save Funding Initiative'}
              </span>
            </button>
          </div>
        </form>
      )}

      {/* Funding Records List */}
      <div className="space-y-4">
        {records.length === 0 ? (
          <div className="bg-white border border-[#08184B]/12 rounded-2xl p-8 text-center text-sm text-[#08184B]/65">
            No project funding initiatives recorded yet.
          </div>
        ) : (
          records.map((item) => (
            <div
              key={item.id}
              data-testid="project-funding-card"
              className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[#08184B]/10 pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#C89212]">
                      {item.programCode}
                    </span>
                    <span className="text-xs font-semibold text-[#08184B]/70 bg-[#FAF8F4] border border-[#08184B]/12 px-2.5 py-0.5 rounded-md">
                      {item.fundingType}
                    </span>
                    <span className="text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/12 px-2.5 py-0.5 rounded-md">
                      {item.status}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                        item.financeClearanceStatus === 'Finance Verified'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      <span>{item.financeClearanceStatus}</span>
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#08184B] pt-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#08184B]/75">
                    Sponsor / Source: <strong>{item.sourceOrSponsor}</strong> · Last updated by{' '}
                    {item.updatedBy}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canClearFinance && (
                    <button
                      type="button"
                      onClick={() => handleToggleFinanceClearance(item)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border cursor-pointer ${
                        item.financeClearanceStatus === 'Finance Verified'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-[#08184B] text-white border-[#08184B] hover:bg-[#0D2570]'
                      }`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {item.financeClearanceStatus === 'Finance Verified'
                          ? 'Finance Cleared (Toggle)'
                          : 'Grant Finance Clearance'}
                      </span>
                    </button>
                  )}

                  {canMutate && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        aria-label={`Delete funding ${item.programCode}`}
                        className="inline-flex items-center p-1.5 text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-[#FAF8F4] border border-[#08184B]/10 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[#08184B]/65">Target Budget</span>
                  <span className="font-mono font-bold text-[#08184B] tabular-nums">
                    {formatPhpCurrency(item.targetAmountPhp)}
                  </span>
                </div>
                <div className="bg-[#FAF8F4] border border-[#08184B]/10 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[#08184B]/65">Committed</span>
                  <span className="font-mono font-bold text-emerald-800 tabular-nums">
                    {formatPhpCurrency(item.committedAmountPhp)}
                  </span>
                </div>
                <div className="bg-[#FAF8F4] border border-[#08184B]/10 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[#08184B]/65 flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-[#C89212]" aria-hidden="true" />
                    Disbursed
                  </span>
                  <span className="font-mono font-bold text-[#A81C1C] tabular-nums">
                    {formatPhpCurrency(item.disbursedAmountPhp)}
                  </span>
                </div>
              </div>

              {item.notes && <p className="text-xs text-[#08184B]/80">{item.notes}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
