import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DepartmentAccessRole } from '../../types/pema';
import { apiFetch } from '../../utils/api';
import { DEPARTMENT_ROLE_CATALOG } from '../../utils/pemaRules';

interface DepartmentAccessTabProps {
  passcodes: Record<DepartmentAccessRole, string> | undefined;
  onNotifySaved: (detail: string) => void;
  onError: (msg: string) => void;
  onReload: () => Promise<void>;
}

const DEPARTMENT_ROLES_ORDER: DepartmentAccessRole[] = [
  'funding',
  'finance',
  'committee',
  'evaluator_1',
  'evaluator_2',
  'evaluator_3',
  'evaluator_4',
];

export function DepartmentAccessTab({
  passcodes,
  onNotifySaved,
  onError,
  onReload,
}: DepartmentAccessTabProps) {
  const [draftPasscodes, setDraftPasscodes] = useState<Record<DepartmentAccessRole, string>>({
    funding: passcodes?.funding ?? '',
    finance: passcodes?.finance ?? '',
    committee: passcodes?.committee ?? '',
    evaluator_1: passcodes?.evaluator_1 ?? '',
    evaluator_2: passcodes?.evaluator_2 ?? '',
    evaluator_3: passcodes?.evaluator_3 ?? '',
    evaluator_4: passcodes?.evaluator_4 ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (passcodes) {
      setDraftPasscodes({ ...passcodes });
    }
  }, [passcodes]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    onError('');
    try {
      await apiFetch('/api/admin/departments/passcodes', {
        method: 'PUT',
        body: JSON.stringify({ passcodes: draftPasscodes }),
      });
      onNotifySaved('Updated separated Departmental Access passcodes.');
      await onReload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unable to save department passcodes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSave}
      data-testid="department-access-tab"
      className="space-y-6"
    >
      <div className="bg-white border border-[#D9A726]/45 rounded-2xl p-6 sm:p-8 space-y-2">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
          Executive Security Governance
        </p>
        <h2 className="font-display text-2xl font-bold text-[#08184B]">
          Separated Departmental Access &amp; Role Matrix
        </h2>
        <p className="text-xs sm:text-sm text-[#08184B]/75 max-w-3xl">
          Each unit signs in through the secured PEMA Administrator Dashboard using Departmental
          Access mode and receives strictly isolated permissions enforced on both UI and server API.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {DEPARTMENT_ROLES_ORDER.map((roleKey) => {
          const meta = DEPARTMENT_ROLE_CATALOG[roleKey];
          return (
            <div
              key={roleKey}
              className="bg-white border border-[#08184B]/12 rounded-2xl p-6 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#C89212]">
                      {meta.unitGroup}
                    </p>
                    <h3 className="font-display text-lg font-bold text-[#08184B]">{meta.title}</h3>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-[#08184B]/60 shrink-0" aria-hidden="true" />
                </div>

                <p className="text-xs text-[#08184B]/75 leading-relaxed">{meta.summary}</p>

                <ul className="space-y-1 text-xs text-[#08184B]/80 pt-1">
                  {meta.responsibilities.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="text-[#C89212] font-bold">&bull;</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-[#08184B]/10">
                <label
                  htmlFor={`passcode-${roleKey}`}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#08184B] mb-1.5"
                >
                  <KeyRound className="h-3.5 w-3.5 text-[#C89212]" aria-hidden="true" />
                  <span>Department Access Passcode</span>
                </label>
                <input
                  id={`passcode-${roleKey}`}
                  type="text"
                  required
                  minLength={6}
                  value={draftPasscodes[roleKey] ?? ''}
                  onChange={(e) =>
                    setDraftPasscodes((prev) => ({ ...prev, [roleKey]: e.target.value }))
                  }
                  className="w-full px-3.5 py-2 text-sm font-mono bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          data-testid="save-department-passcodes-btn"
          className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{saving ? 'Saving...' : 'Save Department Passcodes'}</span>
        </button>
      </div>
    </form>
  );
}
