import {
  Award,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Images,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { CertificatePreviewSheet } from '../components/CertificatePreviewSheet';
import { useToast } from '../components/ToastProvider';
import { BoardEvaluatorTab } from '../components/admin/BoardEvaluatorTab';
import { DepartmentAccessTab } from '../components/admin/DepartmentAccessTab';
import { ProjectFundingTab } from '../components/admin/ProjectFundingTab';
import { usePema } from '../context/PemaContext';
import type {
  AdminDepartmentRole,
  AdminRevisionEntry,
  AwardeeGalleryItem,
  CertificateTemplateConfig,
  ChatThread,
  ContactInquiry,
  DepartmentAccessRole,
  LegitimacyCredential,
  NominationEvaluationScore,
  NominationRecord,
  NominationStatus,
  OrganizationSettings,
  PaymentRecord,
  PaymentStatus,
  ProjectFundingRecord,
  SimulatedEmailNotification,
  UserAccount,
} from '../types/pema';
import { apiFetch, fileToPayload, setAdminToken, type FileUploadPayload } from '../utils/api';
import {
  DEPARTMENT_ROLE_CATALOG,
  MAX_CHAT_ATTACHMENTS,
  NOMINATION_CATEGORY_CLUSTERS,
  canRoleMutatePayments,
  computeFundingSummary,
  computePaymentSummary,
  exportNominationsToCsv,
  filterNominations,
  formatPhpCurrency,
  getAllowedTabsForRole,
  isEvaluatorRole,
} from '../utils/pemaRules';

interface AdminOverview {
  department?: AdminDepartmentRole;
  users: UserAccount[];
  nominations: NominationRecord[];
  payments: PaymentRecord[];
  inquiries: ContactInquiry[];
  emailNotifications: SimulatedEmailNotification[];
  settings: OrganizationSettings;
  awardees: AwardeeGalleryItem[];
  legitimacyCredentials: LegitimacyCredential[];
  projectFunding?: ProjectFundingRecord[];
  nominationEvaluations?: NominationEvaluationScore[];
  departmentPasscodes?: Record<DepartmentAccessRole, string>;
  chatThreads: ChatThread[];
  supportAvailable: boolean;
  revisions: AdminRevisionEntry[];
}

type AdminTab =
  | 'payments'
  | 'nominations'
  | 'board'
  | 'funding'
  | 'certificates'
  | 'emails'
  | 'gallery'
  | 'chat'
  | 'credentials'
  | 'departments'
  | 'editorial'
  | 'settings'
  | 'inquiries';

const DEFAULT_CERT_TEMPLATE: CertificateTemplateConfig = {
  templateName: 'Official PEMA Award Certificate Template',
  uploadedImageUrl: null,
  preserveDesignAsIs: true,
  showEditableOverlay: true,
  defaultAwardeeName: 'Dr. Elena M. Villanueva',
  defaultAwardTitle: 'Outstanding Public Health Advocacy Award',
  defaultProfession: 'Public Health Director & Rural Clinic Founder',
  defaultCitationLine:
    'In recognition of exemplary excellence, integrity, and measurable service to the Filipino community.',
  defaultDateLabel: 'Awarded in the 2027 PEMA Ceremonial Cycle',
  defaultSignatoryLine: 'Philippine Excellency & Merit Awards Screening Committee',
  updatedAt: new Date().toISOString(),
};

export function AdminDashboardPage() {
  const {
    isAdmin,
    setIsAdmin,
    adminName,
    setAdminName,
    adminDepartment,
    setAdminDepartment,
    logoutAdmin,
    refreshLiveContent,
    liveContent,
    eventVersion,
  } = usePema();
  const { showToast } = useToast();

  // Admin Login State (Executive Console + Separated Departmental Access)
  const [loginMode, setLoginMode] = useState<'executive' | 'department'>('executive');
  const [loginDepartment, setLoginDepartment] = useState<DepartmentAccessRole>('funding');
  const [loginStaffName, setLoginStaffName] = useState('');
  const [loginAdminName, setLoginAdminName] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Dashboard Data
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('payments');
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const notifySaved = useCallback(
    (detail: string) => {
      setToast(`Changes Saved Successfully — ${detail}`);
      showToast({
        title: 'Changes Saved Successfully',
        description: detail,
        variant: 'success',
      });
    },
    [showToast],
  );

  // Admin-Only Simulated Email Notifications State
  const [simNomId, setSimNomId] = useState<string>('');
  const [simTargetStatus, setSimTargetStatus] = useState<'Approved' | 'Rejected'>('Approved');
  const [simNote, setSimNote] = useState<string>('');
  const [simulatingEmail, setSimulatingEmail] = useState(false);
  const [previewEmail, setPreviewEmail] = useState<SimulatedEmailNotification | null>(null);

  // 2-Tab Editorial Editor State (Headline Template & Highlight of the Month)
  const [editorialSubTab, setEditorialSubTab] = useState<'headline' | 'highlight'>('headline');

  // Payment Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Nomination Search, Filter & Print Report State
  const [nomSearchQuery, setNomSearchQuery] = useState('');
  const [nomStatusFilter, setNomStatusFilter] = useState<string>('ALL');
  const [showNomPrintReport, setShowNomPrintReport] = useState(false);

  // Award Certificate Template State
  const [certUploadPayload, setCertUploadPayload] = useState<FileUploadPayload | null>(null);
  const [certPreviewDataUrl, setCertPreviewDataUrl] = useState<string | null>(null);
  const [savingCert, setSavingCert] = useState(false);

  // Receipt Upload Modal
  const [receiptTarget, setReceiptTarget] = useState<PaymentRecord | null>(null);
  const [receiptRef, setReceiptRef] = useState('');
  const [amountDue, setAmountDue] = useState('0');
  const [amountPaid, setAmountPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState('');
  const [receiptStatus, setReceiptStatus] = useState<PaymentStatus>('Paid / Verified');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [receiptFilePayload, setReceiptFilePayload] = useState<FileUploadPayload | null>(null);
  const [savingReceipt, setSavingReceipt] = useState(false);

  // New Payment Modal
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [newPayerName, setNewPayerName] = useState('');
  const [newPayerEmail, setNewPayerEmail] = useState('');
  const [newPayerPhone, setNewPayerPhone] = useState('');
  const [newPayDesc, setNewPayDesc] = useState('Awardee Recognition & Gala Package');
  const [newPayDue, setNewPayDue] = useState('15000');
  const [newPayPaid, setNewPayPaid] = useState('0');
  const [newPayStatus, setNewPayStatus] = useState<PaymentStatus>('Pending Payment');

  // Editable Settings State
  const [editSettings, setEditSettings] = useState<OrganizationSettings | null>(null);
  const [logoUpload, setLogoUpload] = useState<FileUploadPayload | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncingLive, setSyncingLive] = useState(false);

  // Gallery Album CRUD State
  const [editingAwardeeId, setEditingAwardeeId] = useState<string | null>(null);
  const [awdName, setAwdName] = useState('');
  const [awdTitle, setAwdTitle] = useState('');
  const [awdProfession, setAwdProfession] = useState('');
  const [awdEra, setAwdEra] = useState<'New Awardee' | 'Past Awardee'>('New Awardee');
  const [awdYearLabel, setAwdYearLabel] = useState('2026–2027 Honoree');
  const [awdPhotoUpload, setAwdPhotoUpload] = useState<FileUploadPayload | null>(null);
  const [savingAwardee, setSavingAwardee] = useState(false);

  // Internal Legitimacy Proofs / Credentials CRUD State
  const [editingCredId, setEditingCredId] = useState<string | null>(null);
  const [credTitle, setCredTitle] = useState('');
  const [credAuthority, setCredAuthority] = useState('');
  const [credRegNo, setCredRegNo] = useState('');
  const [credStatus, setCredStatus] = useState<'Pending Review' | 'Internal Verified'>('Pending Review');
  const [credDetails, setCredDetails] = useState('');
  const [credFileUpload, setCredFileUpload] = useState<FileUploadPayload | null>(null);
  const [savingCred, setSavingCred] = useState(false);

  // Admin Chat Support Desk State
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [chatReplyText, setChatReplyText] = useState('');
  const [chatReplyAttachments, setChatReplyAttachments] = useState<FileUploadPayload[]>([]);
  const [chatMarkResolved, setChatMarkResolved] = useState(false);
  const [sendingChatReply, setSendingChatReply] = useState(false);
  const [togglingSupport, setTogglingSupport] = useState(false);

  const normalizeOverviewSettings = useCallback((settings: OrganizationSettings): OrganizationSettings => {
    return {
      ...settings,
      certificateTemplate: {
        ...DEFAULT_CERT_TEMPLATE,
        ...(settings.certificateTemplate ?? {}),
      },
    };
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await apiFetch<AdminOverview>('/api/admin/overview');
      const normalized = normalizeOverviewSettings(data.settings);
      setOverview({ ...data, settings: normalized });
      setEditSettings(normalized);
      setSimNomId((prev) => {
        if (prev && data.nominations.some((n) => n.id === prev)) return prev;
        const pendingFirst = data.nominations.find((n) => n.status === 'Pending');
        return pendingFirst?.id || data.nominations[0]?.id || '';
      });
      setSelectedThreadId((prev) => {
        if (prev && data.chatThreads.some((t) => t.id === prev)) return prev;
        return data.chatThreads[0]?.id ?? null;
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load admin overview.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, normalizeOverviewSettings]);

  const activeRole: AdminDepartmentRole =
    overview?.department ?? adminDepartment ?? 'executive';
  const allowedTabs = useMemo(() => getAllowedTabsForRole(activeRole), [activeRole]);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0] as AdminTab);
    }
  }, [allowedTabs, activeTab]);

  useEffect(() => {
    if (isAdmin) {
      fetchOverview();
    }
  }, [isAdmin, fetchOverview, eventVersion]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);
    try {
      const payload =
        loginMode === 'department'
          ? {
              accessMode: 'department',
              department: loginDepartment,
              staffName: loginStaffName,
              password,
            }
          : {
              accessMode: 'executive',
              adminName: loginAdminName,
              password,
            };

      const res = await apiFetch<{
        isAdmin: boolean;
        adminName: string;
        department: AdminDepartmentRole;
        token: string;
      }>('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAdminToken(res.token);
      setAdminName(res.adminName);
      setAdminDepartment(res.department ?? 'executive');
      const roleTabs = getAllowedTabsForRole(res.department ?? 'executive');
      if (roleTabs.length > 0) {
        setActiveTab(roleTabs[0] as AdminTab);
      }
      setIsAdmin(true);
      setPassword('');
      setLoginAdminName('');
      setLoginStaffName('');
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : 'Access denied. Check administrator credentials.',
      );
    } finally {
      setLoggingIn(false);
    }
  };

  // Global Revert / Undo Last Admin Change
  const handleUndoLastChange = async () => {
    if (!overview?.revisions.length) return;
    setUndoing(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        revertedRevision: AdminRevisionEntry;
        overview: AdminOverview;
      }>('/api/admin/undo', { method: 'POST' });
      setOverview(res.overview);
      setEditSettings(res.overview.settings);
      await refreshLiveContent(true);
      setToast(`Reverted / Undid: "${res.revertedRevision.label}"`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not revert last change.');
    } finally {
      setUndoing(false);
    }
  };

  const openReceiptModal = (pay: PaymentRecord) => {
    setReceiptTarget(pay);
    setReceiptRef(pay.receiptReference);
    setAmountDue(String(pay.amountDue));
    setAmountPaid(String(pay.amountPaid || pay.amountDue || 0));
    setPaymentMethod(
      pay.paymentMethod &&
        pay.paymentMethod !== 'Pending Assessment' &&
        pay.paymentMethod !== 'To be confirmed'
        ? pay.paymentMethod
        : 'Bank Transfer',
    );
    setPaymentDate(pay.paymentDate || new Date().toISOString().slice(0, 10));
    setReceiptStatus(pay.status === 'Pending Confirmation' ? 'Paid / Verified' : pay.status);
    setAdminRemarks(pay.adminRemarks || '');
    setReceiptFilePayload(null);
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptTarget) return;
    setSavingReceipt(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/payments/${receiptTarget.id}/receipt`, {
        method: 'POST',
        body: JSON.stringify({
          receiptReference: receiptRef,
          amountDue: Number(amountDue),
          amountPaid: Number(amountPaid),
          paymentMethod,
          paymentDate,
          status: receiptStatus,
          adminRemarks,
          receiptFile: receiptFilePayload,
        }),
      });
      notifySaved(`Payment & official receipt persisted for ${receiptTarget.payerName} (${receiptRef}).`);
      setReceiptTarget(null);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update payment receipt.');
    } finally {
      setSavingReceipt(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({
          payerName: newPayerName,
          payerEmail: newPayerEmail,
          payerPhone: newPayerPhone,
          description: newPayDesc,
          amountDue: Number(newPayDue),
          amountPaid: Number(newPayPaid),
          status: newPayStatus,
        }),
      });
      setShowNewPayment(false);
      setNewPayerName('');
      setNewPayerEmail('');
      setNewPayerPhone('');
      notifySaved('New payment tracking record persisted.');
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create payment record.');
    }
  };

  const handleDeletePayment = async (pay: PaymentRecord) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/payments/${pay.id}`, { method: 'DELETE' });
      notifySaved(`Removed payment ${pay.receiptReference}.`);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete payment record.');
    }
  };

  const handleNominationStatus = async (
    nomId: string,
    status: NominationStatus,
    committeeNotes: string,
  ) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        nomination: NominationRecord;
        simulatedEmail: SimulatedEmailNotification | null;
      }>(`/api/admin/nominations/${nomId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, committeeNotes }),
      });
      if (res.simulatedEmail) {
        notifySaved(
          `Updated ${res.nomination.referenceCode} to "${status}" & queued notification email to ${res.simulatedEmail.recipientEmail}.`,
        );
      } else {
        notifySaved(`Updated nomination ${res.nomination.referenceCode} (${status}).`);
      }
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update nomination.');
    }
  };

  const handleDeleteNomination = async (nom: NominationRecord) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/nominations/${nom.id}`, { method: 'DELETE' });
      notifySaved(`Deleted nomination ${nom.referenceCode}.`);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to delete nomination.');
    }
  };

  const handleSimulateEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simNomId) return;
    setSimulatingEmail(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{
        simulatedEmail: SimulatedEmailNotification;
        nomination: NominationRecord;
      }>('/api/admin/notifications/simulate', {
        method: 'POST',
        body: JSON.stringify({
          nominationId: simNomId,
          newStatus: simTargetStatus,
          customNote: simNote,
        }),
      });
      setToast(
        `Simulated ${simTargetStatus} email notification delivered to ${res.simulatedEmail.recipientEmail}.`,
      );
      setSimNote('');
      setPreviewEmail(res.simulatedEmail);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to simulate email notification.');
    } finally {
      setSimulatingEmail(false);
    }
  };

  const handleCancelSettingsDraft = () => {
    if (!overview) return;
    setEditSettings(normalizeOverviewSettings(overview.settings));
    setLogoUpload(null);
    setCertUploadPayload(null);
    setCertPreviewDataUrl(null);
    setToast('Canceled unsaved edits and restored saved settings.');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSettings) return;
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ settings: OrganizationSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...editSettings,
          logoUpload,
        }),
      });
      const normalized = normalizeOverviewSettings(res.settings);
      setEditSettings(normalized);
      setOverview((prev) => (prev ? { ...prev, settings: normalized } : prev));
      setLogoUpload(null);
      await refreshLiveContent(true);
      await fetchOverview();
      notifySaved('Organization settings, editorial tabs, official logo, and pricing published live.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetLogo = async () => {
    setSavingSettings(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ settings: OrganizationSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ resetLogo: true }),
      });
      const normalized = normalizeOverviewSettings(res.settings);
      setEditSettings(normalized);
      setOverview((prev) => (prev ? { ...prev, settings: normalized } : prev));
      setLogoUpload(null);
      await refreshLiveContent(true);
      await fetchOverview();
      notifySaved('Removed uploaded logo and restored the default PEMA crest.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove uploaded logo.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveCertificateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSettings) return;
    setSavingCert(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ settings: OrganizationSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          certificateTemplate: editSettings.certificateTemplate ?? DEFAULT_CERT_TEMPLATE,
          certificateTemplateUpload: certUploadPayload,
        }),
      });
      const normalized = normalizeOverviewSettings(res.settings);
      setEditSettings(normalized);
      setOverview((prev) => (prev ? { ...prev, settings: normalized } : prev));
      setCertUploadPayload(null);
      setCertPreviewDataUrl(null);
      await refreshLiveContent(true);
      await fetchOverview();
      notifySaved('Award Certificate design & template details locked and persisted.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save certificate template.');
    } finally {
      setSavingCert(false);
    }
  };

  const handleRemoveCertificateImage = async () => {
    setSavingCert(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ settings: OrganizationSettings }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ resetCertificateTemplate: true }),
      });
      const normalized = normalizeOverviewSettings(res.settings);
      setEditSettings(normalized);
      setOverview((prev) => (prev ? { ...prev, settings: normalized } : prev));
      setCertUploadPayload(null);
      setCertPreviewDataUrl(null);
      await refreshLiveContent(true);
      await fetchOverview();
      notifySaved('Removed uploaded certificate image.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove certificate image.');
    } finally {
      setSavingCert(false);
    }
  };

  const handleExportNominationsCsv = (rowsToExport: NominationRecord[]) => {
    const csv = exportNominationsToCsv(rowsToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `pema-nominations-${dateStamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast(`Exported ${rowsToExport.length} nomination records to CSV.`);
  };

  // Gallery Album Helpers
  const resetAwardeeForm = () => {
    setEditingAwardeeId(null);
    setAwdName('');
    setAwdTitle('');
    setAwdProfession('');
    setAwdEra('New Awardee');
    setAwdYearLabel('2026–2027 Honoree');
    setAwdPhotoUpload(null);
  };

  const startEditAwardee = (item: AwardeeGalleryItem) => {
    setEditingAwardeeId(item.id);
    setAwdName(item.awardeeName);
    setAwdTitle(item.awardTitle);
    setAwdProfession(item.profession);
    setAwdEra(item.era);
    setAwdYearLabel(item.yearLabel);
    setAwdPhotoUpload(null);
  };

  const handleSaveAwardee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAwardee(true);
    setErrorMsg(null);
    try {
      if (editingAwardeeId) {
        await apiFetch(`/api/admin/awardees/${editingAwardeeId}`, {
          method: 'PUT',
          body: JSON.stringify({
            awardeeName: awdName,
            awardTitle: awdTitle,
            profession: awdProfession,
            era: awdEra,
            yearLabel: awdYearLabel,
            photoUpload: awdPhotoUpload,
          }),
        });
        notifySaved(`Updated awardee "${awdName}" in PEMA Gallery Album.`);
      } else {
        await apiFetch('/api/admin/awardees', {
          method: 'POST',
          body: JSON.stringify({
            awardeeName: awdName,
            awardTitle: awdTitle,
            profession: awdProfession,
            era: awdEra,
            yearLabel: awdYearLabel,
            photoUpload: awdPhotoUpload,
          }),
        });
        notifySaved(`Uploaded awardee "${awdName}" to live PEMA Gallery Album.`);
      }
      resetAwardeeForm();
      await refreshLiveContent(true);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save awardee gallery item.');
    } finally {
      setSavingAwardee(false);
    }
  };

  const handleDeleteAwardee = async (item: AwardeeGalleryItem) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/awardees/${item.id}`, { method: 'DELETE' });
      if (editingAwardeeId === item.id) resetAwardeeForm();
      notifySaved(`Removed "${item.awardeeName}" from Gallery Album.`);
      await refreshLiveContent(true);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not remove awardee item.');
    }
  };

  // Legitimacy Proof / Credentials Helpers (Internal Only)
  const resetCredForm = () => {
    setEditingCredId(null);
    setCredTitle('');
    setCredAuthority('');
    setCredRegNo('');
    setCredStatus('Pending Review');
    setCredDetails('');
    setCredFileUpload(null);
  };

  const startEditCred = (c: LegitimacyCredential) => {
    setEditingCredId(c.id);
    setCredTitle(c.title);
    setCredAuthority(c.issuingAuthority);
    setCredRegNo(c.registrationNumber);
    setCredStatus(c.status);
    setCredDetails(c.details);
    setCredFileUpload(null);
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCred(true);
    setErrorMsg(null);
    try {
      if (editingCredId) {
        await apiFetch(`/api/admin/credentials/${editingCredId}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: credTitle,
            issuingAuthority: credAuthority,
            registrationNumber: credRegNo,
            status: credStatus,
            details: credDetails,
            fileUpload: credFileUpload,
          }),
        });
        notifySaved(`Updated internal registration proof "${credTitle}".`);
      } else {
        await apiFetch('/api/admin/credentials', {
          method: 'POST',
          body: JSON.stringify({
            title: credTitle,
            issuingAuthority: credAuthority,
            registrationNumber: credRegNo,
            status: credStatus,
            details: credDetails,
            fileUpload: credFileUpload,
          }),
        });
        notifySaved(`Saved internal legitimacy proof "${credTitle}".`);
      }
      resetCredForm();
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save credential record.');
    } finally {
      setSavingCred(false);
    }
  };

  const handleDeleteCredential = async (c: LegitimacyCredential) => {
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/credentials/${c.id}`, { method: 'DELETE' });
      if (editingCredId === c.id) resetCredForm();
      setToast(`Deleted credential "${c.title}". Use Revert/Undo to restore.`);
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not delete credential.');
    }
  };

  // Chat Support Desk Helpers
  const handleToggleSupportAvailability = async () => {
    if (!overview) return;
    setTogglingSupport(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch<{ supportAvailable: boolean }>('/api/admin/support/availability', {
        method: 'POST',
        body: JSON.stringify({ available: !overview.supportAvailable }),
      });
      await fetchOverview();
      await refreshLiveContent(false);
      setToast(
        res.supportAvailable
          ? 'Human Chat Support set to Online / Available.'
          : 'Human Chat Support set to Busy / Away (PEMA AI Assistant active for basic inquiries).',
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update support availability.');
    } finally {
      setTogglingSupport(false);
    }
  };

  const handleAdminChatReplyFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = Math.max(0, MAX_CHAT_ATTACHMENTS - chatReplyAttachments.length);
    const chosen = files.slice(0, remaining);
    const payloads = await Promise.all(chosen.map((f) => fileToPayload(f)));
    setChatReplyAttachments((prev) => [...prev, ...payloads].slice(0, MAX_CHAT_ATTACHMENTS));
    e.target.value = '';
  };

  const handleSendAdminChatReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedThreadId) return;
    if (!chatReplyText.trim() && chatReplyAttachments.length === 0) return;
    setSendingChatReply(true);
    setErrorMsg(null);
    try {
      await apiFetch(`/api/admin/chat/${selectedThreadId}/reply`, {
        method: 'POST',
        body: JSON.stringify({
          text: chatReplyText,
          attachments: chatReplyAttachments,
          markResolved: chatMarkResolved,
        }),
      });
      setChatReplyText('');
      setChatReplyAttachments([]);
      setChatMarkResolved(false);
      setToast('Support reply & attachment dispatched to customer ticket.');
      await fetchOverview();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send chat reply.');
    } finally {
      setSendingChatReply(false);
    }
  };

  const filteredPayments = useMemo(() => {
    if (!overview) return [];
    const q = searchQuery.trim().toLowerCase();
    return overview.payments.filter((p) => {
      const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
      const matchesQuery =
        !q ||
        p.payerName.toLowerCase().includes(q) ||
        p.payerEmail.toLowerCase().includes(q) ||
        p.receiptReference.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
  }, [overview, searchQuery, statusFilter]);

  const filteredNominations = useMemo(() => {
    return filterNominations(overview?.nominations ?? [], nomSearchQuery, nomStatusFilter);
  }, [overview?.nominations, nomSearchQuery, nomStatusFilter]);

  const paymentSummary = useMemo(
    () => computePaymentSummary(overview?.payments ?? []),
    [overview?.payments],
  );

  const fundingSummary = useMemo(
    () => computeFundingSummary(overview?.projectFunding ?? []),
    [overview?.projectFunding],
  );

  const activeThread = useMemo(
    () => overview?.chatThreads.find((t) => t.id === selectedThreadId) ?? null,
    [overview?.chatThreads, selectedThreadId],
  );

  // Secured Login Gate (Executive Console + Separated Departmental Access; zero secret leakage)
  if (!isAdmin) {
    return (
      <div className="bg-[#FAF8F4] min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 py-16">
        <div className="w-full max-w-md bg-white border border-[#08184B]/15 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-4">
            <OfficialSealMedallion size="sm" />
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                Restricted Console
              </p>
              <h1 className="font-display text-2xl font-bold text-[#08184B]">
                PEMA Administrator Dashboard
              </h1>
            </div>
          </div>

          <div
            role="tablist"
            aria-label="Sign in access mode"
            className="grid grid-cols-2 gap-1.5 bg-[#FAF8F4] p-1.5 rounded-xl border border-[#08184B]/12"
          >
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'executive'}
              data-testid="login-mode-executive"
              onClick={() => {
                setLoginMode('executive');
                setLoginError(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg cursor-pointer ${
                loginMode === 'executive'
                  ? 'bg-[#08184B] text-white'
                  : 'text-[#08184B]/75 hover:text-[#08184B]'
              }`}
            >
              Executive Console
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'department'}
              data-testid="login-mode-department"
              onClick={() => {
                setLoginMode('department');
                setLoginError(null);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-lg cursor-pointer ${
                loginMode === 'department'
                  ? 'bg-[#08184B] text-white'
                  : 'text-[#08184B]/75 hover:text-[#08184B]'
              }`}
            >
              Departmental Access
            </button>
          </div>

          <p className="text-sm text-[#08184B]/75">
            {loginMode === 'executive'
              ? 'Access is restricted exclusively to authorized PEMA administrators. Enter your assigned administrator name and security password to continue.'
              : 'Select your assigned PEMA Department or Committee on Board Evaluator seat to sign in to your separated operational workspace.'}
          </p>

          {loginError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
            >
              {loginError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            {loginMode === 'executive' ? (
              <div>
                <label
                  htmlFor="admin-name"
                  className="block text-sm font-semibold text-[#08184B] mb-1.5"
                >
                  Authorized Administrator Name
                </label>
                <div className="relative">
                  <UserCheck
                    className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="admin-name"
                    type="text"
                    required
                    value={loginAdminName}
                    onChange={(e) => setLoginAdminName(e.target.value)}
                    placeholder="Enter authorized administrator name"
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label
                    htmlFor="dept-role-select"
                    className="block text-sm font-semibold text-[#08184B] mb-1.5"
                  >
                    Department / Board Evaluator Role
                  </label>
                  <div className="relative">
                    <Building2
                      className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <select
                      id="dept-role-select"
                      data-testid="dept-role-select"
                      value={loginDepartment}
                      onChange={(e) => setLoginDepartment(e.target.value as DepartmentAccessRole)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                    >
                      <option value="funding">PEMA Project Funding Department</option>
                      <option value="finance">PEMA Official Finance Department</option>
                      <option value="committee">Committee on Board (Board Governance)</option>
                      <option value="evaluator_1">Committee on Board — Evaluator 1</option>
                      <option value="evaluator_2">Committee on Board — Evaluator 2</option>
                      <option value="evaluator_3">Committee on Board — Evaluator 3</option>
                      <option value="evaluator_4">Committee on Board — Evaluator 4</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="dept-staff-name"
                    className="block text-sm font-semibold text-[#08184B] mb-1.5"
                  >
                    Officer / Evaluator Name
                  </label>
                  <div className="relative">
                    <UserCheck
                      className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="dept-staff-name"
                      data-testid="dept-staff-name"
                      type="text"
                      required
                      value={loginStaffName}
                      onChange={(e) => setLoginStaffName(e.target.value)}
                      placeholder="Enter your officer or evaluator name"
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label
                htmlFor="admin-password"
                className="block text-sm font-semibold text-[#08184B] mb-1.5"
              >
                {loginMode === 'executive' ? 'Administrator Password' : 'Department Access Passcode'}
              </label>
              <div className="relative">
                <Lock
                  className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    loginMode === 'executive'
                      ? 'Enter admin password'
                      : 'Enter department access passcode'
                  }
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
            >
              {loggingIn
                ? 'Verifying...'
                : loginMode === 'executive'
                  ? 'Unlock Administrator Dashboard'
                  : 'Enter Departmental Workspace'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const roleMeta = DEPARTMENT_ROLE_CATALOG[activeRole];
  const isExecutive = activeRole === 'executive';
  const canEditPayments = canRoleMutatePayments(activeRole);
  const isBoardOrEvalView = activeRole === 'committee' || isEvaluatorRole(activeRole);

  const allTabDefs: Array<{ id: AdminTab; label: string; icon?: typeof Images }> = [
    {
      id: 'payments',
      label: activeRole === 'funding' ? 'Payments Overview' : 'Payments & Receipts',
    },
    { id: 'nominations', label: `Nominations (${overview?.nominations.length ?? 0})` },
    {
      id: 'board',
      label: isEvaluatorRole(activeRole)
        ? `${roleMeta.shortLabel} Desk`
        : `Board & 4 Evaluators (${overview?.nominationEvaluations?.length ?? 0})`,
      icon: ClipboardCheck,
    },
    {
      id: 'funding',
      label:
        activeRole === 'finance'
          ? `Funding Clearance (${overview?.projectFunding?.length ?? 0})`
          : `Project Funding (${overview?.projectFunding?.length ?? 0})`,
      icon: Coins,
    },
    { id: 'certificates', label: 'Certificate Template', icon: Award },
    {
      id: 'emails',
      label: `Email Notifications (${overview?.emailNotifications?.length ?? 0})`,
    },
    {
      id: 'gallery',
      label: `Gallery Album (${overview?.awardees.length ?? 0})`,
      icon: Images,
    },
    {
      id: 'chat',
      label: `Chat Support (${overview?.chatThreads.length ?? 0})`,
      icon: MessageSquare,
    },
    {
      id: 'credentials',
      label: `Legitimacy Proofs (${overview?.legitimacyCredentials.length ?? 0})`,
      icon: ShieldCheck,
    },
    {
      id: 'departments',
      label: 'Department Access (7 Units)',
      icon: KeyRound,
    },
    { id: 'editorial', label: 'Headline & Highlight (2 Tabs)' },
    { id: 'settings', label: 'Organization, Logo & Sync' },
    { id: 'inquiries', label: `Inquiries (${overview?.inquiries.length ?? 0})` },
  ];

  const visibleTabs = allTabDefs.filter((t) => allowedTabs.includes(t.id));

  return (
    <div className="bg-[#FAF8F4] min-h-[calc(100vh-4rem)] py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Admin Top Header */}
        <div className="no-print bg-[#08184B] text-white rounded-2xl p-6 sm:p-8 border border-[#D9A726]/35 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <OfficialSealMedallion size="sm" />
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#D9A726]">
                {roleMeta.unitGroup} · Signed in: {adminName || roleMeta.shortLabel}
              </p>
              <h1
                data-testid="admin-workspace-heading"
                className="font-display text-2xl sm:text-3xl font-bold"
              >
                {roleMeta.title}
              </h1>
              <p className="text-xs text-white/75 mt-1 max-w-2xl">{roleMeta.summary}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isExecutive && (
              <button
                type="button"
                disabled={undoing || !overview?.revisions.length}
                onClick={handleUndoLastChange}
                title={
                  overview?.revisions[0]
                    ? `Revert: ${overview.revisions[0].label}`
                    : 'No prior changes to revert'
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-white/10 hover:bg-white/20 disabled:opacity-45 border border-white/25 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>
                  {undoing
                    ? 'Reverting...'
                    : `Revert / Undo (${overview?.revisions.length ?? 0})`}
                </span>
              </button>
            )}

            {canEditPayments && (
              <button
                type="button"
                onClick={() => setShowNewPayment(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Record Payment</span>
              </button>
            )}

            <button
              type="button"
              onClick={logoutAdmin}
              data-testid="admin-logout-btn"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white border border-white/25 hover:border-white rounded-lg cursor-pointer whitespace-nowrap"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>Lock Console</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="no-print p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-4 text-sm text-emerald-900">
            <span className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>{toast}</span>
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss message"
              className="cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="no-print p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {/* Role-Tailored KPI Strip */}
        {isBoardOrEvalView ? (
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">Nomination Dossiers</p>
              <p className="font-mono text-2xl font-bold text-[#08184B] tabular-nums">
                {overview?.nominations.length ?? 0}
              </p>
              <p className="text-xs text-[#08184B]/55">Active committee cycle</p>
            </div>
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">Evaluator Scorecards</p>
              <p className="font-mono text-2xl font-bold text-emerald-800 tabular-nums">
                {overview?.nominationEvaluations?.length ?? 0}
              </p>
              <p className="text-xs text-[#08184B]/55">4-Evaluator panel submissions</p>
            </div>
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">Pending / Under Eval</p>
              <p className="font-mono text-2xl font-bold text-[#A81C1C] tabular-nums">
                {overview?.nominations.filter(
                  (n) => n.status === 'Pending' || n.status === 'Under Evaluation',
                ).length ?? 0}
              </p>
              <p className="text-xs text-[#08184B]/55">Awaiting deliberation</p>
            </div>
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">Approved / Qualified</p>
              <p className="font-mono text-2xl font-bold text-[#08184B] tabular-nums">
                {overview?.nominations.filter(
                  (n) =>
                    n.status === 'Approved' ||
                    n.status === 'Qualified' ||
                    n.status === 'Awardee Confirmed',
                ).length ?? 0}
              </p>
              <p className="text-xs text-[#08184B]/55">Board endorsed</p>
            </div>
          </div>
        ) : (
          <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">
                {activeRole === 'funding' ? 'Funding Target Pool' : 'Total Billed'}
              </p>
              <p className="font-mono text-2xl font-bold text-[#08184B] tabular-nums">
                {activeRole === 'funding'
                  ? formatPhpCurrency(fundingSummary.totalTargetPhp)
                  : formatPhpCurrency(paymentSummary.totalBilledPhp)}
              </p>
              <p className="text-xs text-[#08184B]/55 tabular-nums">
                {activeRole === 'funding'
                  ? `${fundingSummary.totalInitiatives} initiatives`
                  : `${paymentSummary.totalRecords} payment records`}
              </p>
            </div>
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">
                {activeRole === 'funding' ? 'Committed Funds' : 'Verified Collected'}
              </p>
              <p className="font-mono text-2xl font-bold text-emerald-800 tabular-nums">
                {activeRole === 'funding'
                  ? formatPhpCurrency(fundingSummary.totalCommittedPhp)
                  : formatPhpCurrency(paymentSummary.totalPaidPhp)}
              </p>
              <p className="text-xs text-[#08184B]/55 tabular-nums">
                {activeRole === 'funding'
                  ? `${fundingSummary.financeVerifiedCount} finance verified`
                  : `${paymentSummary.verifiedCount} settled / verified`}
              </p>
            </div>
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">
                {activeRole === 'funding' ? 'Disbursed to Date' : 'Pending / Outstanding'}
              </p>
              <p className="font-mono text-2xl font-bold text-[#A81C1C] tabular-nums">
                {activeRole === 'funding'
                  ? formatPhpCurrency(fundingSummary.totalDisbursedPhp)
                  : formatPhpCurrency(paymentSummary.outstandingPhp)}
              </p>
              <p className="text-xs text-[#08184B]/55 tabular-nums">
                {activeRole === 'funding'
                  ? `${formatPhpCurrency(fundingSummary.remainingToTargetPhp)} gap`
                  : `${paymentSummary.pendingCount} awaiting action`}
              </p>
            </div>
            <div className="bg-white border border-[#08184B]/12 rounded-xl p-5 space-y-1">
              <p className="text-xs font-medium text-[#08184B]/65">
                {isExecutive ? 'Awardees & Chat Tickets' : 'Funding Initiatives'}
              </p>
              <p className="font-mono text-2xl font-bold text-[#08184B] tabular-nums">
                {isExecutive
                  ? `${overview?.awardees.length ?? 0} / ${overview?.chatThreads.length ?? 0}`
                  : `${fundingSummary.totalInitiatives}`}
              </p>
              <p className="text-xs text-[#08184B]/55 tabular-nums">
                {isExecutive
                  ? `${overview?.legitimacyCredentials.length ?? 0} internal legitimacy proofs`
                  : `${fundingSummary.financeVerifiedCount} Finance cleared`}
              </p>
            </div>
          </div>
        )}

        {/* Navigation Tabs (Strictly Filtered by Authorized Departmental Role) */}
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-[#08184B]/12 pb-3">
          {visibleTabs.map((t) => {
            const IconComp = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                aria-current={activeTab === t.id ? 'page' : undefined}
                onClick={() => setActiveTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border cursor-pointer whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-[#08184B] text-white border-[#08184B] shadow-xs'
                    : 'bg-white/80 text-[#08184B]/80 border-[#08184B]/12 hover:bg-white hover:text-[#08184B]'
                }`}
              >
                {IconComp && <IconComp className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab: Payments & Receipts */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search payer, email, or receipt reference..."
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                />
              </div>
              <select
                aria-label="Filter payments by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3.5 py-2 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
              >
                <option value="ALL">All Statuses</option>
                <option value="Pending Confirmation">Pending Confirmation</option>
                <option value="Pending Payment">Pending Payment</option>
                <option value="Receipt Uploaded">Receipt Uploaded</option>
                <option value="Partial">Partial</option>
                <option value="Paid / Verified">Paid / Verified</option>
                <option value="Waived">Waived</option>
              </select>
            </div>

            <div className="bg-white border border-[#08184B]/12 rounded-2xl overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="border-b border-[#08184B]/10 text-xs uppercase tracking-wider text-[#08184B]/60 bg-[#FAF8F4]">
                    <th className="py-3.5 px-3.5 font-semibold whitespace-nowrap">Ref #</th>
                    <th className="py-3.5 px-3.5 font-semibold">Nominee / Payer</th>
                    <th className="py-3.5 px-3.5 font-semibold">Description</th>
                    <th className="py-3.5 px-3.5 font-semibold text-right">Due</th>
                    <th className="py-3.5 px-3.5 font-semibold text-right">Paid</th>
                    <th className="py-3.5 px-3.5 font-semibold">Status</th>
                    <th className="py-3.5 px-3.5 font-semibold">Attachments</th>
                    <th className="py-3.5 px-3.5 font-semibold text-right whitespace-nowrap">
                      Manage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#08184B]/10 text-sm">
                  {loading && !overview ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#08184B]/60">
                        Loading payment ledger...
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-[#08184B]/60">
                        No payment records match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((pay) => (
                      <tr key={pay.id} className="hover:bg-[#FAF8F4]/70">
                        <td className="py-3.5 px-3.5 font-mono text-xs font-semibold text-[#08184B] tabular-nums whitespace-nowrap">
                          {pay.receiptReference}
                        </td>
                        <td className="py-3.5 px-3.5 max-w-[200px]">
                          <p className="font-semibold text-[#08184B] truncate">{pay.payerName}</p>
                          <p className="text-xs text-[#08184B]/65 truncate">{pay.payerEmail}</p>
                          {pay.payerPhone && (
                            <p className="text-xs text-[#08184B]/55 tabular-nums">
                              {pay.payerPhone}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 max-w-[220px]">
                          <p className="text-xs font-medium text-[#08184B] line-clamp-2">
                            {pay.description}
                          </p>
                          {pay.adminRemarks && (
                            <p className="text-[11px] text-[#08184B]/60 truncate">
                              {pay.adminRemarks}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-xs tabular-nums text-[#08184B] whitespace-nowrap">
                          {formatPhpCurrency(pay.amountDue)}
                        </td>
                        <td className="py-3.5 px-3.5 text-right font-mono text-xs font-semibold tabular-nums text-[#08184B] whitespace-nowrap">
                          {formatPhpCurrency(pay.amountPaid)}
                        </td>
                        <td className="py-3.5 px-3.5 text-xs font-semibold whitespace-nowrap">
                          <span
                            className={
                              pay.status === 'Paid / Verified'
                                ? 'text-emerald-800'
                                : pay.status === 'Partial' || pay.status === 'Receipt Uploaded'
                                ? 'text-amber-800'
                                : 'text-[#08184B]/80'
                            }
                          >
                            {pay.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs space-y-1">
                          {pay.officialReceiptFile ? (
                            <a
                              href={pay.officialReceiptFile.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-semibold text-emerald-800 hover:underline"
                            >
                              <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Official Receipt</span>
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="text-[#08184B]/45 block">No admin receipt yet</span>
                          )}
                          {pay.userProofFile && (
                            <a
                              href={pay.userProofFile.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#08184B] hover:underline"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>User Proof</span>
                            </a>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {canEditPayments ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openReceiptModal(pay)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer whitespace-nowrap"
                              >
                                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Upload Receipt</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePayment(pay)}
                                aria-label={`Delete payment ${pay.receiptReference}`}
                                className="inline-flex items-center p-1.5 text-[#A81C1C] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-medium text-[#08184B]/50">
                              Finance Only
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Nominations (Search Bar + CSV & Print-Ready PDF Exports) */}
        {activeTab === 'nominations' && (
          <div className={`space-y-4 ${showNomPrintReport ? 'no-print' : ''}`}>
            <div className="bg-white border border-[#08184B]/12 rounded-xl px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#08184B]/75">
              <span>
                Changing a nomination status to <strong>Approved</strong> or{' '}
                <strong>Rejected</strong> automatically triggers an Admin-only Simulated Email
                Notification to the nominee. All edits and deletions can be reverted with Undo.
              </span>
              <button
                type="button"
                onClick={() => setActiveTab('emails')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#08184B] hover:text-[#A81C1C] cursor-pointer whitespace-nowrap"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>View Email Notifications Log</span>
              </button>
            </div>

            {/* Nominations Search, Status Filter, CSV Export & Print-Ready PDF Bar */}
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search
                    className="h-4 w-4 text-[#08184B]/45 absolute left-3.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={nomSearchQuery}
                    onChange={(e) => setNomSearchQuery(e.target.value)}
                    placeholder="Search nominations by name, email, ref #, or status..."
                    aria-label="Search nominations by name, email, or status"
                    data-testid="admin-nomination-search"
                    className="w-full pl-10 pr-4 py-2 text-sm bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                  />
                </div>

                <select
                  aria-label="Filter nominations by status"
                  data-testid="admin-nomination-status-filter"
                  value={nomStatusFilter}
                  onChange={(e) => setNomStatusFilter(e.target.value)}
                  className="px-3.5 py-2 text-sm bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                >
                  <option value="ALL">All Statuses ({overview?.nominations.length ?? 0})</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Under Evaluation">Under Evaluation</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Awardee Confirmed">Awardee Confirmed</option>
                  <option value="Not Selected">Not Selected</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[#08184B]/65 tabular-nums mr-1">
                  Showing {filteredNominations.length} of {overview?.nominations.length ?? 0}
                </span>
                <button
                  type="button"
                  data-testid="export-nominations-csv-btn"
                  disabled={filteredNominations.length === 0}
                  onClick={() => handleExportNominationsCsv(filteredNominations)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/25 hover:border-[#08184B] disabled:opacity-45 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  data-testid="export-nominations-pdf-btn"
                  disabled={filteredNominations.length === 0}
                  onClick={() => setShowNomPrintReport(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-45 rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Print-Ready PDF</span>
                </button>
              </div>
            </div>

            {filteredNominations.length === 0 ? (
              <div className="bg-white border border-[#08184B]/12 rounded-2xl p-8 text-center text-sm text-[#08184B]/65">
                No nominations match your current search or status filter.
              </div>
            ) : (
              filteredNominations.map((nom) => (
              <div
                key={nom.id}
                data-testid="admin-nomination-card"
                className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[#08184B]/10 pb-4">
                  <div className="space-y-1">
                    <p className="font-mono text-xs text-[#C89212] font-semibold tabular-nums">
                      {nom.referenceCode} · Age {nom.currentAge} · Current Status: {nom.status}
                    </p>
                    <h3 className="font-display text-xl font-bold text-[#08184B]">
                      {nom.completeName}
                    </h3>
                    <p className="text-sm text-[#08184B]/80 font-medium">
                      {nom.currentWorkProfession}
                    </p>
                    <p className="text-xs text-[#08184B]/65">
                      {nom.phoneNumber} · {nom.emailAddress} · {nom.completeAddress}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {nom.status !== 'Approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleNominationStatus(
                            nom.id,
                            'Approved',
                            'Credentials verified and approved by the PEMA Screening Committee.',
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Approve &amp; Save
                      </button>
                    )}
                    {nom.status !== 'Rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleNominationStatus(
                            nom.id,
                            'Rejected',
                            'Reviewed by the PEMA Screening Committee; not selected for this cycle.',
                          )
                        }
                        className="px-3 py-2 text-xs font-semibold text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer whitespace-nowrap"
                      >
                        Reject &amp; Save
                      </button>
                    )}
                    <select
                      aria-label={`Evaluation status for ${nom.completeName}`}
                      value={nom.status}
                      onChange={(e) =>
                        handleNominationStatus(
                          nom.id,
                          e.target.value as NominationStatus,
                          nom.committeeNotes,
                        )
                      }
                      className="px-3 py-2 text-xs font-semibold bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Approved">Approved</option>
                      <option value="Rejected">Rejected</option>
                      <option value="Under Evaluation">Under Evaluation</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Qualified">Qualified</option>
                      <option value="Awardee Confirmed">Awardee Confirmed</option>
                      <option value="Not Selected">Not Selected</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleDeleteNomination(nom)}
                      aria-label={`Delete nomination ${nom.referenceCode}`}
                      className="inline-flex items-center p-2 text-[#A81C1C] bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {nom.majorProjects && (
                  <div className="text-sm text-[#08184B]/80">
                    <strong className="text-[#08184B]">Projects / Advocacy:</strong>{' '}
                    {nom.majorProjects}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  {nom.cvFile ? (
                    <a
                      href={nom.cvFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-[#08184B] hover:text-[#A81C1C]"
                    >
                      <FileText className="h-4 w-4" aria-hidden="true" />
                      <span>CV / PDS: {nom.cvFile.fileName}</span>
                    </a>
                  ) : (
                    <span className="text-[#08184B]/60">
                      CV / PDS: {nom.cvWillFollow ? 'To follow once qualified' : 'Not provided'}
                    </span>
                  )}

                  {nom.supportingDocs.map((doc, idx) => (
                    <a
                      key={idx}
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
              </div>
              ))
            )}
          </div>
        )}

        {/* Tab: Committee on Board & 4 Evaluators Panel */}
        {activeTab === 'board' && overview && (
          <BoardEvaluatorTab
            role={activeRole}
            staffName={adminName || roleMeta.shortLabel}
            nominations={overview.nominations}
            evaluations={overview.nominationEvaluations ?? []}
            onNotifySaved={notifySaved}
            onError={(msg) => setErrorMsg(msg || null)}
            onReload={fetchOverview}
          />
        )}

        {/* Tab: PEMA Project Funding Department / Official Finance Clearance */}
        {activeTab === 'funding' && overview && (
          <ProjectFundingTab
            role={activeRole}
            records={overview.projectFunding ?? []}
            onNotifySaved={notifySaved}
            onError={(msg) => setErrorMsg(msg || null)}
            onReload={fetchOverview}
          />
        )}

        {/* Tab: Executive Department Access Governance */}
        {activeTab === 'departments' && isExecutive && (
          <DepartmentAccessTab
            passcodes={overview?.departmentPasscodes}
            onNotifySaved={notifySaved}
            onError={(msg) => setErrorMsg(msg || null)}
            onReload={fetchOverview}
          />
        )}

        {/* Tab 2B: Award Certificate Template (Admin Photo Upload -> Instant Editable As-Is Template & Print PDF) */}
        {activeTab === 'certificates' && editSettings && (
          <div className="space-y-6">
            {(() => {
              const cert = editSettings.certificateTemplate ?? DEFAULT_CERT_TEMPLATE;
              const updateCert = (patch: Partial<CertificateTemplateConfig>) => {
                setEditSettings({
                  ...editSettings,
                  certificateTemplate: {
                    ...cert,
                    ...patch,
                  },
                });
              };
              const allCategoryAwards = NOMINATION_CATEGORY_CLUSTERS.flatMap((c) => c.awards);

              return (
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  {/* Left: Admin Certificate Design Upload & Editable Details Form (.no-print) */}
                  <form
                    onSubmit={handleSaveCertificateTemplate}
                    className="no-print xl:col-span-5 bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-5"
                  >
                    <div className="border-b border-[#08184B]/10 pb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                          Direct Certificate Design Upload
                        </p>
                        <h2 className="font-display text-xl font-bold text-[#08184B] mt-1">
                          Award Certificate Template
                        </h2>
                        <p className="text-xs text-[#08184B]/70 mt-1">
                          Upload your certificate photo directly. It becomes an editable template
                          automatically without altering your original design or included artwork.
                        </p>
                      </div>
                    </div>

                    {/* Direct Image Upload */}
                    <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-[#08184B]">
                        1. Upload Certificate Design Image (As-Is Full Artwork)
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 hover:border-[#08184B] rounded-lg cursor-pointer">
                          <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {certUploadPayload
                              ? certUploadPayload.fileName
                              : cert.uploadedImageUrl
                              ? 'Replace Certificate Design Photo'
                              : 'Upload Certificate Design Photo'}
                          </span>
                          <input
                            id="cert-design-upload"
                            data-testid="cert-design-upload"
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              e.target.value = '';
                              if (!file) return;
                              const payload = await fileToPayload(file);
                              setCertUploadPayload(payload);
                              setCertPreviewDataUrl(payload.dataUrl);
                            }}
                            className="sr-only"
                          />
                        </label>

                        {(cert.uploadedImageUrl || certPreviewDataUrl) && (
                          <button
                            type="button"
                            onClick={handleRemoveCertificateImage}
                            disabled={savingCert}
                            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Remove Uploaded Photo</span>
                          </button>
                        )}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-[#08184B]/85 cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={cert.showEditableOverlay}
                          onChange={(e) => updateCert({ showEditableOverlay: e.target.checked })}
                          className="h-4 w-4 accent-[#08184B]"
                        />
                        <span>
                          Show Editable Details Overlay on Uploaded Design (uncheck to print pure uploaded photo as-is)
                        </span>
                      </label>
                    </div>

                    {/* Nominee Quick-Fill + Award Category Picker */}
                    <div className="space-y-3">
                      <p className="text-xs font-semibold text-[#08184B]">
                        2. Edit Certificate Details
                      </p>

                      {overview && overview.nominations.length > 0 && (
                        <div>
                          <label
                            htmlFor="cert-nominee-prefill"
                            className="block text-[11px] font-semibold text-[#08184B]/75 mb-1"
                          >
                            Quick-Fill from Nominee Record
                          </label>
                          <select
                            id="cert-nominee-prefill"
                            defaultValue=""
                            onChange={(e) => {
                              const nom = overview.nominations.find((n) => n.id === e.target.value);
                              if (nom) {
                                updateCert({
                                  defaultAwardeeName: nom.completeName,
                                  defaultProfession: nom.currentWorkProfession,
                                });
                              }
                            }}
                            className="w-full px-3 py-2 text-xs bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg"
                          >
                            <option value="">-- Select nominee to populate name &amp; profession --</option>
                            {overview.nominations.map((n) => (
                              <option key={n.id} value={n.id}>
                                {n.referenceCode} — {n.completeName} ({n.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="cert-awardee-name"
                          className="block text-xs font-semibold text-[#08184B] mb-1"
                        >
                          Honoree / Awardee Complete Name
                        </label>
                        <input
                          id="cert-awardee-name"
                          data-testid="cert-awardee-name-input"
                          type="text"
                          value={cert.defaultAwardeeName}
                          onChange={(e) => updateCert({ defaultAwardeeName: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm font-semibold border border-[#08184B]/20 rounded-lg"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cert-award-title"
                          className="block text-xs font-semibold text-[#08184B] mb-1"
                        >
                          Award Title / Category
                        </label>
                        <input
                          id="cert-award-title"
                          data-testid="cert-award-title-input"
                          type="text"
                          value={cert.defaultAwardTitle}
                          onChange={(e) => updateCert({ defaultAwardTitle: e.target.value })}
                          list="pema-award-categories-datalist"
                          className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                        />
                        <datalist id="pema-award-categories-datalist">
                          {allCategoryAwards.map((award) => (
                            <option key={award} value={award} />
                          ))}
                        </datalist>
                      </div>

                      <div>
                        <label
                          htmlFor="cert-profession"
                          className="block text-xs font-semibold text-[#08184B] mb-1"
                        >
                          Profession / Institution
                        </label>
                        <input
                          id="cert-profession"
                          type="text"
                          value={cert.defaultProfession}
                          onChange={(e) => updateCert({ defaultProfession: e.target.value })}
                          className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="cert-citation"
                          className="block text-xs font-semibold text-[#08184B] mb-1"
                        >
                          Citation Text
                        </label>
                        <textarea
                          id="cert-citation"
                          rows={2}
                          value={cert.defaultCitationLine}
                          onChange={(e) => updateCert({ defaultCitationLine: e.target.value })}
                          className="w-full px-3.5 py-2 text-xs border border-[#08184B]/20 rounded-lg"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="cert-date-label"
                            className="block text-xs font-semibold text-[#08184B] mb-1"
                          >
                            Conferral Date Label
                          </label>
                          <input
                            id="cert-date-label"
                            type="text"
                            value={cert.defaultDateLabel}
                            onChange={(e) => updateCert({ defaultDateLabel: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-[#08184B]/20 rounded-lg"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="cert-signatory"
                            className="block text-xs font-semibold text-[#08184B] mb-1"
                          >
                            Signatory Line
                          </label>
                          <input
                            id="cert-signatory"
                            type="text"
                            value={cert.defaultSignatoryLine}
                            onChange={(e) => updateCert({ defaultSignatoryLine: e.target.value })}
                            className="w-full px-3 py-2 text-xs border border-[#08184B]/20 rounded-lg"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-[#08184B]/10">
                      <button
                        type="button"
                        disabled={undoing || !overview?.revisions.length}
                        onClick={handleUndoLastChange}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 disabled:opacity-45 rounded-lg cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Revert / Undo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelSettingsDraft}
                        className="px-3.5 py-2 text-xs font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        data-testid="save-certificate-template-btn"
                        disabled={savingCert}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer"
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{savingCert ? 'Saving...' : 'Save Template'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Right: Live Print-Ready Certificate Preview Sheet */}
                  <div className="xl:col-span-7 print:col-span-12 bg-white border border-[#08184B]/12 print:border-0 rounded-2xl p-5 sm:p-6 print:p-0">
                    <CertificatePreviewSheet
                      template={cert}
                      previewImageDataUrl={certPreviewDataUrl}
                      showPrintButton={true}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 3: Admin-Only Simulated Email Notifications */}
        {activeTab === 'emails' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-5">
              <div className="border-b border-[#08184B]/10 pb-4">
                <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                  Administrator-Only Dispatch Tool
                </p>
                <h2 className="font-display text-xl font-bold text-[#08184B] mt-1">
                  Simulate Status Email Notification (Pending &#8594; Approved / Rejected)
                </h2>
                <p className="text-xs text-[#08184B]/70 mt-1">
                  Simulate and record official email notifications dispatched to nominees when their
                  nomination transitions from Pending to Approved or Rejected.
                </p>
              </div>

              <form
                onSubmit={handleSimulateEmailSubmit}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end"
              >
                <div className="md:col-span-5">
                  <label
                    htmlFor="sim-nominee"
                    className="block text-xs font-semibold text-[#08184B] mb-1.5"
                  >
                    Target Nomination
                  </label>
                  <select
                    id="sim-nominee"
                    value={simNomId}
                    onChange={(e) => setSimNomId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg"
                  >
                    {overview?.nominations.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.referenceCode} — {n.completeName} ({n.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-3">
                  <label
                    htmlFor="sim-decision"
                    className="block text-xs font-semibold text-[#08184B] mb-1.5"
                  >
                    Decision Status
                  </label>
                  <select
                    id="sim-decision"
                    value={simTargetStatus}
                    onChange={(e) => setSimTargetStatus(e.target.value as 'Approved' | 'Rejected')}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg font-semibold"
                  >
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>

                <div className="md:col-span-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSimNote('');
                      setToast('Canceled email note draft.');
                    }}
                    className="px-4 py-2.5 text-sm font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={simulatingEmail || !simNomId}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>{simulatingEmail ? 'Sending...' : 'Save & Send Email'}</span>
                  </button>
                </div>

                <div className="md:col-span-12">
                  <label
                    htmlFor="sim-note"
                    className="block text-xs font-semibold text-[#08184B] mb-1.5"
                  >
                    Optional Committee Remarks (included in email body)
                  </label>
                  <input
                    id="sim-note"
                    type="text"
                    value={simNote}
                    onChange={(e) => setSimNote(e.target.value)}
                    placeholder="e.g., Credentials and community impact portfolio verified for 2027 Gala."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#08184B]/20 rounded-lg"
                  />
                </div>
              </form>
            </div>

            {/* Simulated Email Delivery Log */}
            <div className="bg-white border border-[#08184B]/12 rounded-2xl overflow-x-auto">
              <div className="px-6 py-4 border-b border-[#08184B]/10 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-[#08184B]">
                  Simulated Email Dispatch Log
                </h3>
                <span className="text-xs text-[#08184B]/65 tabular-nums">
                  {overview?.emailNotifications?.length ?? 0} notifications recorded
                </span>
              </div>

              {!overview?.emailNotifications || overview.emailNotifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#08184B]/65">
                  No simulated email notifications dispatched yet. Approve or Reject a Pending
                  nomination above to simulate and inspect the email sent to the user.
                </div>
              ) : (
                <table className="w-full text-left border-collapse min-w-[740px]">
                  <thead>
                    <tr className="border-b border-[#08184B]/10 text-xs uppercase tracking-wider text-[#08184B]/60 bg-[#FAF8F4]">
                      <th className="py-3 px-4 font-semibold">Ref #</th>
                      <th className="py-3 px-4 font-semibold">Recipient</th>
                      <th className="py-3 px-4 font-semibold">Transition</th>
                      <th className="py-3 px-4 font-semibold">Subject</th>
                      <th className="py-3 px-4 font-semibold">Sent At</th>
                      <th className="py-3 px-4 font-semibold text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#08184B]/10 text-sm">
                    {overview.emailNotifications.map((eml) => (
                      <tr key={eml.id} className="hover:bg-[#FAF8F4]/70">
                        <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#08184B] tabular-nums whitespace-nowrap">
                          {eml.referenceCode}
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#08184B]">{eml.recipientName}</p>
                          <p className="text-xs text-[#08184B]/65">{eml.recipientEmail}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs font-semibold whitespace-nowrap">
                          <span className="text-[#08184B]/65">{eml.previousStatus} &#8594; </span>
                          <span
                            className={
                              eml.newStatus === 'Approved' ? 'text-emerald-800' : 'text-[#A81C1C]'
                            }
                          >
                            {eml.newStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#08184B]/85 max-w-[260px] truncate">
                          {eml.subject}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-[#08184B]/65 tabular-nums whitespace-nowrap">
                          {new Date(eml.sentAt).toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setPreviewEmail(eml)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>View Email</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Gallery Photo Album (Add / Replace / Remove New & Past Awardees) */}
        {activeTab === 'gallery' && (
          <div className="space-y-6">
            <form
              onSubmit={handleSaveAwardee}
              className="bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#08184B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                    Awardee Photo Album Manager
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B] mt-1">
                    {editingAwardeeId ? 'Edit / Replace Awardee Entry' : 'Add New or Past Awardee'}
                  </h2>
                  <p className="text-xs text-[#08184B]/70 mt-0.5">
                    Add or remove new and past PEMA awardees with photo, name, award title, and
                    profession. Syncs in real time to the public Gallery page.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={undoing || !overview?.revisions.length}
                  onClick={handleUndoLastChange}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] disabled:opacity-45 rounded-lg cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Revert / Undo</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="awd-name"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Awardee Complete Name *
                  </label>
                  <input
                    id="awd-name"
                    type="text"
                    required
                    value={awdName}
                    onChange={(e) => setAwdName(e.target.value)}
                    placeholder="e.g., Dr. Elena M. Santos, CESO III"
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="awd-title"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Award Title *
                  </label>
                  <input
                    id="awd-title"
                    type="text"
                    required
                    value={awdTitle}
                    onChange={(e) => setAwdTitle(e.target.value)}
                    placeholder="e.g., Outstanding Civic & Public Service Laureate"
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>

                <div>
                  <label
                    htmlFor="awd-prof"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Profession / Sector *
                  </label>
                  <input
                    id="awd-prof"
                    type="text"
                    required
                    value={awdProfession}
                    onChange={(e) => setAwdProfession(e.target.value)}
                    placeholder="e.g., Public Health Administrator & Medical Director"
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="awd-era"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Album Classification
                    </label>
                    <select
                      id="awd-era"
                      value={awdEra}
                      onChange={(e) => {
                        const val = e.target.value as 'New Awardee' | 'Past Awardee';
                        setAwdEra(val);
                        if (!editingAwardeeId) {
                          setAwdYearLabel(
                            val === 'New Awardee' ? '2026–2027 Honoree' : 'Past Honoree',
                          );
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg bg-white"
                    >
                      <option value="New Awardee">New Awardee</option>
                      <option value="Past Awardee">Past Awardee</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="awd-year"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Year / Edition Label
                    </label>
                    <input
                      id="awd-year"
                      type="text"
                      value={awdYearLabel}
                      onChange={(e) => setAwdYearLabel(e.target.value)}
                      placeholder="2026–2027 Honoree"
                      className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#08184B]">
                    Awardee Portrait / Ceremony Photo (Optional, No MB Limit)
                  </p>
                  <p className="text-[11px] text-[#08184B]/65">
                    {awdPhotoUpload
                      ? `Ready to save: ${awdPhotoUpload.fileName}`
                      : 'Upload high-resolution portrait or stage recognition photograph.'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 rounded-lg cursor-pointer self-start sm:self-auto">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{awdPhotoUpload ? awdPhotoUpload.fileName : 'Choose Photo'}</span>
                  <input
                    id="awd-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setAwdPhotoUpload(await fileToPayload(f));
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-[#08184B]/10">
                <button
                  type="button"
                  onClick={() => {
                    resetAwardeeForm();
                    setToast('Canceled awardee album edits.');
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAwardee}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {savingAwardee
                      ? 'Saving...'
                      : editingAwardeeId
                      ? 'Save Replacement'
                      : 'Save to Photo Album'}
                  </span>
                </button>
              </div>
            </form>

            {/* Awardees Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {overview?.awardees.map((awd) => (
                <article
                  key={awd.id}
                  className="bg-white border border-[#08184B]/12 rounded-2xl overflow-hidden flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] bg-[#08184B]/5 overflow-hidden">
                      <img
                        src={awd.photoUrl}
                        alt={awd.awardeeName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5 space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C89212]">
                        {awd.era} · {awd.yearLabel}
                      </p>
                      <h3 className="font-display text-lg font-bold text-[#08184B]">
                        {awd.awardeeName}
                      </h3>
                      <p className="text-sm font-semibold text-[#A81C1C]">{awd.awardTitle}</p>
                      <p className="text-xs text-[#08184B]/75">{awd.profession}</p>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-[#FAF8F4] border-t border-[#08184B]/10 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => startEditAwardee(awd)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Edit / Replace</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAwardee(awd)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Admin Chat Support Desk */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#A81C1C]">
                  Customer Chat Queue &amp; AI Fallback Control
                </p>
                <h2 className="font-display text-lg font-bold text-[#08184B] mt-0.5">
                  Human Support Status:{' '}
                  <span
                    className={
                      overview?.supportAvailable ? 'text-emerald-800' : 'text-[#A81C1C]'
                    }
                  >
                    {overview?.supportAvailable
                      ? 'Online & Available'
                      : 'Busy / Away (AI Basic Details Active)'}
                  </span>
                </h2>
                <p className="text-xs text-[#08184B]/70 mt-0.5">
                  When set to Busy / Away, PEMA AI responds to incoming inquiries using only
                  verified basic webapp details while queuing the ticket for Admin reply.
                </p>
              </div>
              <button
                type="button"
                disabled={togglingSupport}
                onClick={handleToggleSupportAvailability}
                className={`px-4 py-2.5 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap ${
                  overview?.supportAvailable
                    ? 'bg-amber-50 text-[#08184B] border border-[#C89212]/50 hover:bg-amber-100'
                    : 'bg-emerald-700 text-white hover:bg-emerald-800'
                }`}
              >
                {togglingSupport
                  ? 'Updating...'
                  : overview?.supportAvailable
                  ? 'Switch to Busy (Enable AI Fallback)'
                  : 'Switch to Human Support Available'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Ticket Queue List */}
              <div className="lg:col-span-4 bg-white border border-[#08184B]/12 rounded-2xl p-4 space-y-2 max-h-[600px] overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#08184B]/60 px-2 pb-1">
                  Active Member Support Tickets ({overview?.chatThreads.length ?? 0})
                </p>
                {!overview?.chatThreads.length ? (
                  <p className="text-xs text-[#08184B]/60 p-4 text-center">
                    No customer support tickets yet.
                  </p>
                ) : (
                  overview.chatThreads.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedThreadId(t.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer space-y-1 ${
                        selectedThreadId === t.id
                          ? 'bg-[#08184B] text-white border-[#08184B]'
                          : 'bg-[#FAF8F4] text-[#08184B] border-[#08184B]/12 hover:border-[#08184B]/35'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
                        <span
                          className={
                            selectedThreadId === t.id
                              ? 'text-[#EAB308] font-bold'
                              : 'text-[#A81C1C] font-bold'
                          }
                        >
                          {t.ticketNumber}
                        </span>
                        <span className="opacity-80">{t.status}</span>
                      </div>
                      <p className="text-sm font-semibold truncate">{t.customerName}</p>
                      <p className="text-xs opacity-75 truncate">
                        {t.contactNumber} · {t.messages.length} msgs
                      </p>
                    </button>
                  ))
                )}
              </div>

              {/* Conversation Thread Panel */}
              <div className="lg:col-span-8 bg-white border border-[#08184B]/12 rounded-2xl p-6 flex flex-col justify-between min-h-[520px]">
                {!activeThread ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-[#08184B]/60">
                    Select a customer support ticket on the left to inspect and reply.
                  </div>
                ) : (
                  <>
                    <div className="border-b border-[#08184B]/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs font-bold text-[#A81C1C] tabular-nums">
                          TICKET No. {activeThread.ticketNumber} · {activeThread.status}
                        </p>
                        <h3 className="font-display text-lg font-bold text-[#08184B]">
                          {activeThread.customerName}{' '}
                          <span className="text-xs font-normal text-[#08184B]/65">
                            (Account: {activeThread.userAccountName} · {activeThread.userEmail})
                          </span>
                        </h3>
                        <p className="text-xs text-[#08184B]/70 tabular-nums">
                          Active Contact: {activeThread.contactNumber} · Opened{' '}
                          {new Date(activeThread.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 py-4 space-y-3 max-h-[340px] overflow-y-auto">
                      {activeThread.messages.map((msg) => {
                        const isCustomer = msg.senderRole === 'customer';
                        const isAi = msg.senderRole === 'ai';
                        return (
                          <div
                            key={msg.id}
                            className={`rounded-xl p-4 border space-y-2 ${
                              isCustomer
                                ? 'bg-[#FAF8F4] border-[#08184B]/12'
                                : isAi
                                ? 'bg-amber-50/70 border-[#C89212]/35'
                                : 'bg-[#08184B] text-white border-[#08184B]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold">
                                {msg.senderDisplayName}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 tabular-nums ${
                                  isCustomer || isAi ? 'text-[#08184B]/60' : 'text-white/75'
                                }`}
                              >
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                <span>{new Date(msg.sentAt).toLocaleString()}</span>
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                              {msg.text}
                            </p>
                            {msg.attachments.length > 0 && (
                              <div className="space-y-1.5 pt-1">
                                {msg.attachments.map((att, idx) => (
                                  <div key={idx} className="space-y-1">
                                    {att.mimeType.startsWith('image/') && (
                                      <img
                                        src={att.url}
                                        alt={att.fileName}
                                        className="max-h-36 rounded-lg border border-black/10 object-cover"
                                      />
                                    )}
                                    <a
                                      href={att.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${
                                        isCustomer || isAi ? 'text-[#08184B]' : 'text-[#EAB308]'
                                      }`}
                                    >
                                      <Paperclip className="h-3 w-3" aria-hidden="true" />
                                      <span>{att.fileName}</span>
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={handleSendAdminChatReply}
                      className="border-t border-[#08184B]/10 pt-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label
                          htmlFor="admin-chat-reply"
                          className="text-xs font-semibold text-[#08184B]"
                        >
                          Reply as PEMA Support Desk (Customer sees &ldquo;PEMA Support Desk&rdquo;)
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs text-[#08184B]/80 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={chatMarkResolved}
                            onChange={(e) => setChatMarkResolved(e.target.checked)}
                          />
                          <span>Mark Ticket Resolved</span>
                        </label>
                      </div>

                      {chatReplyAttachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {chatReplyAttachments.map((a, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[#FAF8F4] border border-[#08184B]/15 rounded-md text-[#08184B]"
                            >
                              <Paperclip className="h-3 w-3" aria-hidden="true" />
                              <span className="truncate max-w-[160px]">{a.fileName}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setChatReplyAttachments((prev) =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                aria-label="Remove attachment"
                                className="text-[#A81C1C] cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <textarea
                        id="admin-chat-reply"
                        rows={3}
                        value={chatReplyText}
                        onChange={(e) => setChatReplyText(e.target.value)}
                        placeholder="Type official support reply..."
                        className="w-full px-3.5 py-2.5 text-sm border border-[#08184B]/20 rounded-lg"
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 rounded-lg cursor-pointer">
                          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            Attach File/Photo ({chatReplyAttachments.length}/{MAX_CHAT_ATTACHMENTS})
                          </span>
                          <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx"
                            onChange={handleAdminChatReplyFiles}
                            className="sr-only"
                          />
                        </label>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setChatReplyText('');
                              setChatReplyAttachments([]);
                              setChatMarkResolved(false);
                            }}
                            className="px-4 py-2 text-xs font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={
                              sendingChatReply ||
                              (!chatReplyText.trim() && chatReplyAttachments.length === 0)
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-50 rounded-lg cursor-pointer"
                          >
                            <Send className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>{sendingChatReply ? 'Sending...' : 'Send Support Reply'}</span>
                          </button>
                        </div>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Internal Credentials & Registration / Legitimacy Proofs (Strictly Not Public) */}
        {activeTab === 'credentials' && (
          <div className="space-y-6">
            <div className="bg-[#08184B] text-white rounded-2xl p-5 flex items-start gap-3 border border-[#D9A726]/40">
              <ShieldCheck className="h-5 w-5 text-[#EAB308] shrink-0 mt-0.5" aria-hidden="true" />
              <div className="text-xs sm:text-sm space-y-1">
                <p className="font-semibold text-[#EAB308]">
                  Pending Internal Admin Vault — Hidden From Public Pages
                </p>
                <p className="text-white/80">
                  Use this private vault to record organizational credentials, SEC/DTI registration
                  proofs, permits, and legitimacy supporting files while pending public release.
                  Nothing saved here appears on public website screens.
                </p>
              </div>
            </div>

            <form
              onSubmit={handleSaveCredential}
              className="bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#08184B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                    Credentials &amp; Registration Proof
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B] mt-1">
                    {editingCredId
                      ? 'Edit Internal Credential Proof'
                      : 'Add Credential or Registration Proof'}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={undoing || !overview?.revisions.length}
                  onClick={handleUndoLastChange}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] disabled:opacity-45 rounded-lg cursor-pointer self-start sm:self-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Revert / Undo</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="cred-title"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Document / Credential Title *
                  </label>
                  <input
                    id="cred-title"
                    type="text"
                    required
                    value={credTitle}
                    onChange={(e) => setCredTitle(e.target.value)}
                    placeholder="e.g., SEC Certificate of Registration / Business Permit"
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cred-auth"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Issuing Agency / Authority *
                  </label>
                  <input
                    id="cred-auth"
                    type="text"
                    required
                    value={credAuthority}
                    onChange={(e) => setCredAuthority(e.target.value)}
                    placeholder="e.g., Securities and Exchange Commission / BIR / LGU"
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cred-regno"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Registration / Reference Number
                  </label>
                  <input
                    id="cred-regno"
                    type="text"
                    value={credRegNo}
                    onChange={(e) => setCredRegNo(e.target.value)}
                    placeholder="Pending or official registry code"
                    className="w-full px-3.5 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label
                    htmlFor="cred-status"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Internal Verification Status
                  </label>
                  <select
                    id="cred-status"
                    value={credStatus}
                    onChange={(e) =>
                      setCredStatus(e.target.value as 'Pending Review' | 'Internal Verified')
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg bg-white"
                  >
                    <option value="Pending Review">Pending Review</option>
                    <option value="Internal Verified">Internal Verified</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="cred-details"
                  className="block text-xs font-semibold text-[#08184B] mb-1"
                >
                  Registration Details / Compliance Notes
                </label>
                <textarea
                  id="cred-details"
                  rows={3}
                  value={credDetails}
                  onChange={(e) => setCredDetails(e.target.value)}
                  placeholder="Include filing dates, signatories, scope, or pending compliance remarks..."
                  className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                />
              </div>

              <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#08184B]">
                    Upload Registration Proof File or Photo (No MB Limit)
                  </p>
                  <p className="text-[11px] text-[#08184B]/65">
                    {credFileUpload
                      ? `Selected: ${credFileUpload.fileName}`
                      : 'Accepted: PDF, JPG, PNG, DOC/DOCX.'}
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 rounded-lg cursor-pointer self-start sm:self-auto">
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{credFileUpload ? credFileUpload.fileName : 'Upload File / Photo'}</span>
                  <input
                    id="cred-file-input"
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setCredFileUpload(await fileToPayload(f));
                    }}
                    className="sr-only"
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-3 pt-2 border-t border-[#08184B]/10">
                <button
                  type="button"
                  onClick={() => {
                    resetCredForm();
                    setToast('Canceled credential form changes.');
                  }}
                  className="px-4 py-2.5 text-sm font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCred}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {savingCred
                      ? 'Saving...'
                      : editingCredId
                      ? 'Save Updated Proof'
                      : 'Save Proof (Internal Only)'}
                  </span>
                </button>
              </div>
            </form>

            {/* Saved Internal Proofs */}
            <div className="space-y-4">
              {!overview?.legitimacyCredentials.length ? (
                <div className="bg-white border border-[#08184B]/12 rounded-2xl p-8 text-center text-sm text-[#08184B]/65">
                  No credentials or legitimacy proofs added yet. Use the form above to upload
                  registration proofs safely inside this admin console.
                </div>
              ) : (
                overview.legitimacyCredentials.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white border border-[#08184B]/12 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-[11px] font-mono font-semibold text-[#C89212]">
                        {c.status} {c.registrationNumber ? `· Ref: ${c.registrationNumber}` : ''}
                      </p>
                      <h3 className="font-display text-lg font-bold text-[#08184B]">{c.title}</h3>
                      <p className="text-xs font-semibold text-[#A81C1C]">
                        Issuing Authority: {c.issuingAuthority}
                      </p>
                      {c.details && <p className="text-sm text-[#08184B]/75">{c.details}</p>}
                      {c.attachmentFile && (
                        <a
                          href={c.attachmentFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:underline pt-1"
                        >
                          <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                          <span>View Proof File: {c.attachmentFile.fileName}</span>
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditCred(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCredential(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Editable Headline Template & Highlight of the Month (2 Tabs) */}
        {activeTab === 'editorial' && editSettings && (
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#08184B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
                    General Public Editorial Showcase
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B] mt-1">
                    Editable Headline Template &amp; Highlight of the Month (2 Tabs)
                  </h2>
                  <p className="text-xs text-[#08184B]/70 mt-1">
                    Updates publish in real time to the public PEMA Home page two-tab spotlight.
                  </p>
                </div>

                <div
                  role="tablist"
                  aria-label="Admin Editorial 2 Tabs"
                  className="inline-flex items-center gap-2 bg-[#FAF8F4] p-1.5 rounded-xl border border-[#08184B]/12 self-start md:self-auto"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorialSubTab === 'headline'}
                    onClick={() => setEditorialSubTab('headline')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap ${
                      editorialSubTab === 'headline'
                        ? 'bg-[#08184B] text-white'
                        : 'text-[#08184B]/75 hover:text-[#08184B]'
                    }`}
                  >
                    <Megaphone className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tab 1: Headline Template</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorialSubTab === 'highlight'}
                    onClick={() => setEditorialSubTab('highlight')}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap ${
                      editorialSubTab === 'highlight'
                        ? 'bg-[#08184B] text-white'
                        : 'text-[#08184B]/75 hover:text-[#08184B]'
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Tab 2: Highlight of the Month</span>
                  </button>
                </div>
              </div>

              {editorialSubTab === 'headline' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="ed-kicker"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Kicker / Eyebrow Label
                      </label>
                      <input
                        id="ed-kicker"
                        type="text"
                        required
                        value={editSettings.headlineTemplate.kicker}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            headlineTemplate: {
                              ...editSettings.headlineTemplate,
                              kicker: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ed-cta-label"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Button Label
                      </label>
                      <input
                        id="ed-cta-label"
                        type="text"
                        required
                        value={editSettings.headlineTemplate.ctaLabel}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            headlineTemplate: {
                              ...editSettings.headlineTemplate,
                              ctaLabel: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="ed-headline"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Main Headline Text
                    </label>
                    <input
                      id="ed-headline"
                      type="text"
                      required
                      value={editSettings.headlineTemplate.headline}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          headlineTemplate: {
                            ...editSettings.headlineTemplate,
                            headline: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2 text-sm font-semibold border border-[#08184B]/20 rounded-lg"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ed-subheadline"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Supporting Announcement Copy
                    </label>
                    <textarea
                      id="ed-subheadline"
                      rows={3}
                      required
                      value={editSettings.headlineTemplate.subheadline}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          headlineTemplate: {
                            ...editSettings.headlineTemplate,
                            subheadline: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ed-cta-path"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Destination Route
                    </label>
                    <select
                      id="ed-cta-path"
                      value={editSettings.headlineTemplate.ctaPath}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          headlineTemplate: {
                            ...editSettings.headlineTemplate,
                            ctaPath: e.target.value,
                          },
                        })
                      }
                      className="w-full sm:w-64 px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    >
                      <option value="/nominate">Nomination Form (/nominate)</option>
                      <option value="/signup">Sign Up (/signup)</option>
                      <option value="/about">About PEMA (/about)</option>
                      <option value="/pricing">Pricing (/pricing)</option>
                      <option value="/contact">Contact (/contact)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="hl-month"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Month Label
                      </label>
                      <input
                        id="hl-month"
                        type="text"
                        required
                        value={editSettings.highlightOfTheMonth.monthLabel}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            highlightOfTheMonth: {
                              ...editSettings.highlightOfTheMonth,
                              monthLabel: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="hl-category"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Category / Merit Area
                      </label>
                      <input
                        id="hl-category"
                        type="text"
                        required
                        value={editSettings.highlightOfTheMonth.category}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            highlightOfTheMonth: {
                              ...editSettings.highlightOfTheMonth,
                              category: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="hl-title"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Spotlight Feature Title
                      </label>
                      <input
                        id="hl-title"
                        type="text"
                        required
                        value={editSettings.highlightOfTheMonth.title}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            highlightOfTheMonth: {
                              ...editSettings.highlightOfTheMonth,
                              title: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm font-semibold border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="hl-honoree"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Featured Honoree / Organization
                      </label>
                      <input
                        id="hl-honoree"
                        type="text"
                        required
                        value={editSettings.highlightOfTheMonth.honoreeName}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            highlightOfTheMonth: {
                              ...editSettings.highlightOfTheMonth,
                              honoreeName: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="hl-summary"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Highlight Summary
                    </label>
                    <textarea
                      id="hl-summary"
                      rows={3}
                      required
                      value={editSettings.highlightOfTheMonth.summary}
                      onChange={(e) =>
                        setEditSettings({
                          ...editSettings,
                          highlightOfTheMonth: {
                            ...editSettings.highlightOfTheMonth,
                            summary: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="hl-impact"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Measured Impact Note
                      </label>
                      <input
                        id="hl-impact"
                        type="text"
                        required
                        value={editSettings.highlightOfTheMonth.impactNote}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            highlightOfTheMonth: {
                              ...editSettings.highlightOfTheMonth,
                              impactNote: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="hl-cta"
                        className="block text-xs font-semibold text-[#08184B] mb-1"
                      >
                        Spotlight Link Label
                      </label>
                      <input
                        id="hl-cta"
                        type="text"
                        required
                        value={editSettings.highlightOfTheMonth.ctaLabel}
                        onChange={(e) =>
                          setEditSettings({
                            ...editSettings,
                            highlightOfTheMonth: {
                              ...editSettings.highlightOfTheMonth,
                              ctaLabel: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#08184B]/10">
                <button
                  type="button"
                  disabled={undoing || !overview?.revisions.length}
                  onClick={handleUndoLastChange}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 disabled:opacity-45 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Revert / Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelSettingsDraft}
                  className="px-4 py-2.5 text-sm font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>{savingSettings ? 'Saving...' : 'Save & Publish Live'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 8: Organization, Official Logo & Live Sync */}
        {activeTab === 'settings' && editSettings && (
          <form onSubmit={handleSaveSettings} className="space-y-8">
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#08184B]/10 pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#08184B]">
                    Real-Time Website Content Sync
                  </h2>
                  <p className="text-xs text-[#08184B]/65 mt-1">
                    Source: {liveContent?.sourceUrl} · Last synced:{' '}
                    {liveContent?.lastSyncedAt
                      ? new Date(liveContent.lastSyncedAt).toLocaleString()
                      : '—'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={syncingLive}
                  onClick={async () => {
                    setSyncingLive(true);
                    await refreshLiveContent(true);
                    setSyncingLive(false);
                    setToast('Content refreshed in real time from official live PEMA website.');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${syncingLive ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{syncingLive ? 'Syncing...' : 'Pull Live Website Content'}</span>
                </button>
              </div>

              {/* Official Logo Management */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-5">
                <div className="flex items-center gap-4">
                  <OfficialSealMedallion size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-[#08184B]">Official PEMA Logo</p>
                    <p className="text-xs text-[#08184B]/70">
                      Highlighted across header, footer, hero seal, nomination form, and receipts.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 rounded-lg cursor-pointer">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{logoUpload ? logoUpload.fileName : 'Upload Official Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setLogoUpload(await fileToPayload(f));
                      }}
                      className="sr-only"
                    />
                  </label>
                  {(editSettings.customLogoUrl || logoUpload) && (
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      disabled={savingSettings}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#A81C1C] bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove Uploaded Logo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Editable Contact & Org Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Contact Number
                  </label>
                  <input
                    type="text"
                    value={editSettings.contactNumber}
                    onChange={(e) =>
                      setEditSettings({ ...editSettings, contactNumber: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editSettings.contactEmail}
                    onChange={(e) =>
                      setEditSettings({ ...editSettings, contactEmail: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Secretariat / Venue Location (Editable)
                  </label>
                  <input
                    type="text"
                    value={editSettings.officeLocation}
                    onChange={(e) =>
                      setEditSettings({ ...editSettings, officeLocation: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Ceremony Schedule (Editable)
                  </label>
                  <input
                    type="text"
                    value={editSettings.ceremonySchedule}
                    onChange={(e) =>
                      setEditSettings({ ...editSettings, ceremonySchedule: e.target.value })
                    }
                    className="w-full px-3.5 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
              </div>

              {/* Editable Pricing Tiers */}
              <div className="space-y-4 pt-4 border-t border-[#08184B]/10">
                <h3 className="font-display text-lg font-bold text-[#08184B]">
                  Editable Program Pricing Tiers
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {editSettings.pricingTiers.map((tier, idx) => (
                    <div
                      key={tier.id}
                      className="p-4 rounded-xl bg-[#FAF8F4] border border-[#08184B]/12 space-y-3"
                    >
                      <input
                        type="text"
                        aria-label={`Tier ${idx + 1} name`}
                        value={tier.name}
                        onChange={(e) => {
                          const next = [...editSettings.pricingTiers];
                          next[idx] = { ...tier, name: e.target.value };
                          setEditSettings({ ...editSettings, pricingTiers: next });
                        }}
                        className="w-full px-3 py-1.5 text-sm font-semibold bg-white border border-[#08184B]/20 rounded-md"
                      />
                      <input
                        type="number"
                        aria-label={`Tier ${idx + 1} PHP amount`}
                        placeholder="Leave blank if pending"
                        value={tier.amountPhp ?? ''}
                        onChange={(e) => {
                          const next = [...editSettings.pricingTiers];
                          next[idx] = {
                            ...tier,
                            amountPhp: e.target.value === '' ? null : Number(e.target.value),
                          };
                          setEditSettings({ ...editSettings, pricingTiers: next });
                        }}
                        className="w-full px-3 py-1.5 text-sm bg-white border border-[#08184B]/20 rounded-md tabular-nums"
                      />
                      <input
                        type="text"
                        aria-label={`Tier ${idx + 1} label`}
                        value={tier.priceLabel}
                        onChange={(e) => {
                          const next = [...editSettings.pricingTiers];
                          next[idx] = { ...tier, priceLabel: e.target.value };
                          setEditSettings({ ...editSettings, pricingTiers: next });
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-[#08184B]/20 rounded-md"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#08184B]/10">
                <button
                  type="button"
                  disabled={undoing || !overview?.revisions.length}
                  onClick={handleUndoLastChange}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/20 disabled:opacity-45 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Revert / Undo</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelSettingsDraft}
                  className="px-4 py-2.5 text-sm font-semibold text-[#08184B] border border-[#08184B]/25 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                >
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>{savingSettings ? 'Saving...' : 'Save All Organization Settings'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Tab 9: Contact Inquiries */}
        {activeTab === 'inquiries' && (
          <div className="space-y-4">
            {overview?.inquiries.map((inq) => (
              <div
                key={inq.id}
                className="bg-white border border-[#08184B]/12 rounded-2xl p-6 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[#08184B]">
                    {inq.name} ·{' '}
                    <span className="font-normal text-[#08184B]/70">{inq.email}</span>
                  </p>
                  <span className="text-xs text-[#08184B]/60 tabular-nums">
                    {new Date(inq.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#A81C1C]">{inq.subject}</p>
                <p className="text-sm text-[#08184B]/80">{inq.message}</p>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Upload Official Payment Receipt */}
        {receiptTarget && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Upload Payment Receipt"
            className="fixed inset-0 z-50 bg-[#051034]/70 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="bg-white border border-[#08184B]/15 rounded-2xl max-w-lg w-full p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-[#08184B]/10 pb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#C89212]">
                    Official Receipt Upload
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B]">
                    {receiptTarget.payerName}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setReceiptTarget(null)}
                  aria-label="Close modal"
                  className="p-1.5 text-[#08184B]/60 hover:text-[#08184B] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveReceipt} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="rcp-ref"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Receipt Reference #
                    </label>
                    <input
                      id="rcp-ref"
                      type="text"
                      required
                      value={receiptRef}
                      onChange={(e) => setReceiptRef(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rcp-status"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Payment Status
                    </label>
                    <select
                      id="rcp-status"
                      value={receiptStatus}
                      onChange={(e) => setReceiptStatus(e.target.value as PaymentStatus)}
                      className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    >
                      <option value="Paid / Verified">Paid / Verified</option>
                      <option value="Partial">Partial</option>
                      <option value="Receipt Uploaded">Receipt Uploaded</option>
                      <option value="Pending Payment">Pending Payment</option>
                      <option value="Pending Confirmation">Pending Confirmation</option>
                      <option value="Waived">Waived</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="rcp-due"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Amount Due (PHP)
                    </label>
                    <input
                      id="rcp-due"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amountDue}
                      onChange={(e) => setAmountDue(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg tabular-nums"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rcp-paid"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Amount Paid (PHP)
                    </label>
                    <input
                      id="rcp-paid"
                      type="number"
                      min={0}
                      step="0.01"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="rcp-method"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Payment Method
                    </label>
                    <input
                      id="rcp-method"
                      type="text"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      placeholder="Bank Transfer / GCash / Cash"
                      className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="rcp-date"
                      className="block text-xs font-semibold text-[#08184B] mb-1"
                    >
                      Payment Date
                    </label>
                    <input
                      id="rcp-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                    />
                  </div>
                </div>

                <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 space-y-2">
                  <label
                    htmlFor="rcp-file"
                    className="block text-xs font-semibold text-[#08184B]"
                  >
                    Upload Official Receipt File (Image or PDF, No MB Limit)
                  </label>
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/25 rounded-lg cursor-pointer">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {receiptFilePayload
                        ? receiptFilePayload.fileName
                        : 'Select receipt image or PDF'}
                    </span>
                    <input
                      id="rcp-file"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) setReceiptFilePayload(await fileToPayload(f));
                      }}
                      className="sr-only"
                    />
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="rcp-remarks"
                    className="block text-xs font-semibold text-[#08184B] mb-1"
                  >
                    Administrator Remarks
                  </label>
                  <textarea
                    id="rcp-remarks"
                    rows={2}
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                    placeholder="Verification notes or official receipt remarks..."
                    className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReceiptTarget(null)}
                    className="px-4 py-2.5 text-sm font-medium text-[#08184B]/75 hover:text-[#08184B] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingReceipt}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                  >
                    {savingReceipt ? 'Saving...' : 'Save & Publish Receipt'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Record New Payment */}
        {showNewPayment && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Record New Payment"
            className="fixed inset-0 z-50 bg-[#051034]/70 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="bg-white border border-[#08184B]/15 rounded-2xl max-w-md w-full p-7 space-y-5">
              <div className="flex items-center justify-between border-b border-[#08184B]/10 pb-3">
                <h2 className="font-display text-xl font-bold text-[#08184B]">
                  Record New Payment
                </h2>
                <button
                  type="button"
                  onClick={() => setShowNewPayment(false)}
                  aria-label="Close modal"
                  className="p-1.5 text-[#08184B]/60 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreatePayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Payer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPayerName}
                    onChange={(e) => setNewPayerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Payer Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newPayerEmail}
                    onChange={(e) => setNewPayerEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">Phone</label>
                  <input
                    type="tel"
                    value={newPayerPhone}
                    onChange={(e) => setNewPayerPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">
                    Description *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPayDesc}
                    onChange={(e) => setNewPayDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#08184B] mb-1">
                      Amount Due (PHP)
                    </label>
                    <input
                      type="number"
                      value={newPayDue}
                      onChange={(e) => setNewPayDue(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#08184B] mb-1">
                      Amount Paid (PHP)
                    </label>
                    <input
                      type="number"
                      value={newPayPaid}
                      onChange={(e) => setNewPayPaid(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-[#08184B]/20 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#08184B] mb-1">Status</label>
                  <select
                    value={newPayStatus}
                    onChange={(e) => setNewPayStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 text-sm border border-[#08184B]/20 rounded-lg"
                  >
                    <option value="Pending Payment">Pending Payment</option>
                    <option value="Pending Confirmation">Pending Confirmation</option>
                    <option value="Partial">Partial</option>
                    <option value="Paid / Verified">Paid / Verified</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewPayment(false)}
                    className="px-4 py-2 text-sm text-[#08184B]/70 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-sm font-semibold text-white bg-[#08184B] rounded-lg cursor-pointer"
                  >
                    Save Payment Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Simulated Email Notification Preview */}
        {previewEmail && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Simulated Email Notification Preview"
            className="fixed inset-0 z-50 bg-[#051034]/70 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="bg-white border border-[#D9A726]/40 rounded-2xl max-w-2xl w-full p-7 space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-[#08184B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#A81C1C]">
                    Simulated Email Notification · {previewEmail.deliveryStatus}
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B] mt-1">
                    {previewEmail.subject}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewEmail(null)}
                  aria-label="Close email preview"
                  className="p-1.5 text-[#08184B]/60 hover:text-[#08184B] cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="bg-[#FAF8F4] border border-[#08184B]/12 rounded-xl p-4 text-xs space-y-1.5 text-[#08184B]/80">
                <p>
                  <strong>To:</strong> {previewEmail.recipientName} &lt;
                  {previewEmail.recipientEmail}&gt;
                </p>
                <p>
                  <strong>Reference:</strong> {previewEmail.referenceCode} ·{' '}
                  <strong>Transition:</strong> {previewEmail.previousStatus} &#8594;{' '}
                  <span
                    className={
                      previewEmail.newStatus === 'Approved'
                        ? 'font-bold text-emerald-800'
                        : 'font-bold text-[#A81C1C]'
                    }
                  >
                    {previewEmail.newStatus}
                  </span>
                </p>
                <p className="tabular-nums">
                  <strong>Dispatched:</strong> {new Date(previewEmail.sentAt).toLocaleString()}
                </p>
              </div>

              <pre className="whitespace-pre-wrap font-sans text-sm text-[#08184B] leading-relaxed bg-white border border-[#08184B]/10 rounded-xl p-5">
                {previewEmail.body}
              </pre>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewEmail(null)}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Print-Ready PDF Nominations Report */}
        {showNomPrintReport && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Print-Ready PEMA Nominations Report"
            data-testid="print-ready-nominations-modal"
            className="fixed inset-0 z-50 bg-[#051034]/70 print:static print:bg-white flex items-start justify-center p-4 sm:p-8 print:p-0 overflow-y-auto"
          >
            <div className="bg-white border border-[#D9A726]/40 print:border-0 rounded-2xl max-w-5xl w-full p-6 sm:p-8 print:p-0 space-y-6 my-4 print:my-0">
              <div className="no-print flex items-center justify-between border-b border-[#08184B]/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#A81C1C]">
                    Records Management · Print-Ready Report
                  </p>
                  <h2 className="font-display text-xl font-bold text-[#08184B]">
                    Official PEMA Nominations Summary ({filteredNominations.length} Records)
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    data-testid="trigger-nominations-print-btn"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Print / Save PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNomPrintReport(false)}
                    aria-label="Close print report"
                    className="p-2 text-[#08184B]/70 hover:text-[#08184B] cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Official Branded Printable Header */}
              <div className="flex items-center justify-between gap-4 border-b border-[#08184B]/15 pb-4">
                <div className="flex items-center gap-4">
                  <OfficialSealMedallion size="sm" />
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#08184B]">
                      Philippine Excellency and Merit Awards (PEMA)
                    </h3>
                    <p className="text-xs text-[#08184B]/70">
                      Official Nominations Register · Generated {new Date().toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-[#08184B]/75">
                  <p>
                    Filter: <strong>{nomStatusFilter}</strong>
                    {nomSearchQuery ? ` · Query: "${nomSearchQuery}"` : ''}
                  </p>
                  <p className="font-mono font-bold text-[#08184B] tabular-nums">
                    Total Rows: {filteredNominations.length}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-[#08184B]/20 bg-[#FAF8F4] text-[#08184B]">
                      <th className="py-2.5 px-3 font-semibold">Ref #</th>
                      <th className="py-2.5 px-3 font-semibold">Complete Name</th>
                      <th className="py-2.5 px-3 font-semibold">Profession</th>
                      <th className="py-2.5 px-3 font-semibold">Contact</th>
                      <th className="py-2.5 px-3 font-semibold">Age</th>
                      <th className="py-2.5 px-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#08184B]/10">
                    {filteredNominations.map((nom) => (
                      <tr key={nom.id} className="print-avoid-break">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#08184B] whitespace-nowrap tabular-nums">
                          {nom.referenceCode}
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="font-semibold text-[#08184B]">{nom.completeName}</p>
                          <p className="text-[11px] text-[#08184B]/65">{nom.completeAddress}</p>
                        </td>
                        <td className="py-2.5 px-3 text-[#08184B]/85">
                          {nom.currentWorkProfession}
                        </td>
                        <td className="py-2.5 px-3 text-[#08184B]/80">
                          <p>{nom.emailAddress}</p>
                          <p className="tabular-nums">{nom.phoneNumber}</p>
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums">{nom.currentAge}</td>
                        <td className="py-2.5 px-3 font-semibold text-[#08184B] whitespace-nowrap">
                          {nom.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
