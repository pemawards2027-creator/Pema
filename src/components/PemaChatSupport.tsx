import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FileText,
  MessageCircle,
  Paperclip,
  Send,
  Ticket,
  UserPlus,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePema } from '../context/PemaContext';
import type { ChatThread } from '../types/pema';
import { apiFetch, fileToPayload, type FileUploadPayload } from '../utils/api';
import {
  MAX_CHAT_ATTACHMENTS,
  MAX_CHAT_INQUIRY_CHARS,
  MIN_CHAT_INQUIRY_CHARS,
  validateChatIntake,
} from '../utils/pemaRules';
import { OfficialSealMedallion } from './BrandMark';

interface PemaChatSupportProps {
  onNavigate: (path: string) => void;
}

function formatMessageDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PemaChatSupport({ onNavigate }: PemaChatSupportProps) {
  const { user, eventVersion, liveContent } = usePema();
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [previewTicketNumber, setPreviewTicketNumber] = useState<string>('TKT-2027-0001');
  const [supportAvailable, setSupportAvailable] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);

  // Pre-chat Ticket Intake State
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [inquiryReason, setInquiryReason] = useState('');
  const [intakeFiles, setIntakeFiles] = useState<FileUploadPayload[]>([]);
  const [starting, setStarting] = useState(false);

  // Active Chat Composer State
  const [messageText, setMessageText] = useState('');
  const [composerFiles, setComposerFiles] = useState<FileUploadPayload[]>([]);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const loadThread = useCallback(async () => {
    if (!user) {
      setThread(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{
        thread: ChatThread | null;
        supportAvailable: boolean;
        previewTicketNumber: string;
      }>('/api/chat/my-thread');
      setThread(data.thread);
      setSupportAvailable(data.supportAvailable);
      setPreviewTicketNumber(data.previewTicketNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load chat support.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      setCustomerName((prev) => prev || user.fullName);
      setContactNumber((prev) => prev || user.phoneNumber || '');
    } else {
      setThread(null);
    }
  }, [user]);

  useEffect(() => {
    if (open && user) {
      loadThread();
    }
  }, [open, user, eventVersion, loadThread]);

  useEffect(() => {
    if (liveContent && typeof liveContent.supportAvailable === 'boolean') {
      setSupportAvailable(liveContent.supportAvailable);
    }
  }, [liveContent]);

  useEffect(() => {
    if (open && thread) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [open, thread?.messages.length, thread]);

  const handleAttachFiles = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<FileUploadPayload[]>>,
    currentCount: number,
  ) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;
    const remainingSlots = MAX_CHAT_ATTACHMENTS - currentCount;
    if (remainingSlots <= 0) {
      setError(`Maximum of ${MAX_CHAT_ATTACHMENTS} files or photos allowed.`);
      return;
    }
    try {
      const payloads = await Promise.all(selected.slice(0, remainingSlots).map(fileToPayload));
      setter((prev) => [...prev, ...payloads].slice(0, MAX_CHAT_ATTACHMENTS));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read selected file.');
    }
  };

  const handleStartChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAiNotice(null);

    const validation = validateChatIntake({
      customerName,
      contactNumber,
      inquiryReason,
      attachmentCount: intakeFiles.length,
    });
    if (!validation.valid) {
      const firstErr =
        validation.errors.customerName ||
        validation.errors.contactNumber ||
        validation.errors.inquiryReason ||
        validation.errors.attachments ||
        'Please complete all required fields.';
      setError(firstErr);
      return;
    }

    setStarting(true);
    try {
      const res = await apiFetch<{ thread: ChatThread; aiNotice?: string | null }>('/api/chat/start', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          contactNumber,
          inquiryReason,
          attachments: intakeFiles,
        }),
      });
      setThread(res.thread);
      setIntakeFiles([]);
      if (res.aiNotice) setAiNotice(res.aiNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start support chat.');
    } finally {
      setStarting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() && composerFiles.length === 0) return;
    setError(null);
    setAiNotice(null);
    setSending(true);
    try {
      const res = await apiFetch<{ thread: ChatThread; aiNotice?: string | null }>('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({
          text: messageText,
          attachments: composerFiles,
        }),
      });
      setThread(res.thread);
      setMessageText('');
      setComposerFiles([]);
      if (res.aiNotice) setAiNotice(res.aiNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const activeTicketNo = thread?.ticketNumber || previewTicketNumber;

  return (
    <>
      {/* Small PEMA CHAT SUPPORT Floating Button Above Bottom-Right INSTALL Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open PEMA Chat Support"
        data-testid="pema-chat-support-button"
        className="no-print fixed bottom-[76px] right-5 z-40 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white text-[#08184B] border border-[#08184B]/25 shadow-lg shadow-[#051034]/15 hover:border-[#D9A726] hover:bg-[#FAF8F4] transition-colors duration-150 cursor-pointer whitespace-nowrap"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#08184B] text-[#EAB308] shrink-0">
          <MessageCircle className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.08em] uppercase">PEMA CHAT SUPPORT</span>
      </button>

      {/* Conversational Support Window */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="PEMA Chat Support"
          className="no-print fixed bottom-5 right-5 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-h-[82vh] bg-white border border-[#D9A726]/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Chat Header */}
          <div className="bg-[#08184B] text-white px-5 py-4 flex items-start justify-between gap-3 border-b border-[#D9A726]/35">
            <div className="flex items-center gap-3">
              <OfficialSealMedallion size="sm" />
              <div>
                <p className="font-display text-base font-bold leading-tight">PEMA Chat Support</p>
                {user ? (
                  <p className="text-[11px] text-[#EAB308] font-mono font-semibold mt-0.5 flex items-center gap-1 tabular-nums">
                    <Ticket className="h-3 w-3" aria-hidden="true" />
                    <span>TICKET No.: {activeTicketNo}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-white/75 mt-0.5">Official Secretariat Assistance</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat support"
              className="p-1 text-white/70 hover:text-white cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Account-Only Access Gate */}
          {!user ? (
            <div className="p-6 space-y-4 bg-[#FAF8F4]">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#A81C1C]">
                  Account Required
                </p>
                <h3 className="font-display text-xl font-bold text-[#08184B]">
                  Sign in or create a PEMA account to chat
                </h3>
                <p className="text-sm text-[#08184B]/80 leading-relaxed">
                  Each registered PEMA account receives a dedicated 1-to-1 support conversation and
                  official Queue Ticket No. Creating an account is also required to submit a nomination.
                </p>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onNavigate('/signup');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#08184B] bg-[#EAB308] hover:bg-[#F3C63B] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                  <span>Create PEMA Account</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onNavigate('/login');
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer whitespace-nowrap"
                >
                  Sign In
                </button>
              </div>
            </div>
          ) : loading && !thread ? (
            <div className="p-8 text-center text-sm text-[#08184B]/70">
              Loading your PEMA support conversation...
            </div>
          ) : !thread ? (
            /* Pre-Chat Ticket & 10-200 Char Inquiry Gate */
            <form onSubmit={handleStartChat} className="p-5 space-y-3.5 overflow-y-auto bg-[#FAF8F4]">
              <div className="bg-white border border-[#08184B]/12 rounded-xl p-3 text-xs text-[#08184B]/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#08184B]">
                    Account: {user.fullName}
                  </span>
                  <span className="font-mono font-bold text-[#A81C1C] tabular-nums">
                    {activeTicketNo}
                  </span>
                </div>
                <p>
                  {supportAvailable
                    ? 'Human support is currently online and ready to assist after ticket intake.'
                    : 'Human support is currently busy; your Ticket No. is queued and our AI assistant can answer basic PEMA details.'}
                </p>
              </div>

              {error && (
                <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="chat-name" className="block text-xs font-semibold text-[#08184B] mb-1">
                  Complete Name *
                </label>
                <input
                  id="chat-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your complete name"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#08184B]/20 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="chat-contact" className="block text-xs font-semibold text-[#08184B] mb-1">
                  Active Contact Number *
                </label>
                <input
                  id="chat-contact"
                  type="tel"
                  required
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g., 0924-173-7587"
                  className="w-full px-3 py-2 text-sm bg-white border border-[#08184B]/20 rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label htmlFor="chat-reason" className="text-xs font-semibold text-[#08184B] whitespace-nowrap">
                    Inquiry Reason *
                  </label>
                  <span
                    data-testid="chat-inquiry-counter"
                    className={`text-[11px] font-mono tabular-nums whitespace-nowrap ${
                      inquiryReason.trim().length >= MIN_CHAT_INQUIRY_CHARS &&
                      inquiryReason.trim().length <= MAX_CHAT_INQUIRY_CHARS
                        ? 'text-emerald-700 font-semibold'
                        : 'text-[#A81C1C]'
                    }`}
                  >
                    {inquiryReason.trim().length} / {MAX_CHAT_INQUIRY_CHARS} chars (min{' '}
                    {MIN_CHAT_INQUIRY_CHARS})
                  </span>
                </div>
                <textarea
                  id="chat-reason"
                  rows={4}
                  required
                  minLength={MIN_CHAT_INQUIRY_CHARS}
                  maxLength={MAX_CHAT_INQUIRY_CHARS}
                  value={inquiryReason}
                  onChange={(e) => setInquiryReason(e.target.value)}
                  placeholder="Please explain your inquiry, nomination reference, or payment concern (10–200 characters)..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#08184B]/20 rounded-lg leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08184B] bg-white border border-[#08184B]/20 hover:border-[#08184B] rounded-lg cursor-pointer">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Upload File / Photo (Optional · Max 2)</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      disabled={intakeFiles.length >= MAX_CHAT_ATTACHMENTS}
                      onChange={(e) => handleAttachFiles(e, setIntakeFiles, intakeFiles.length)}
                      className="sr-only"
                    />
                  </label>
                  <span className="text-[11px] text-[#08184B]/60 tabular-nums">
                    {intakeFiles.length}/{MAX_CHAT_ATTACHMENTS} attached
                  </span>
                </div>

                {intakeFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {intakeFiles.map((f, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-white border border-[#08184B]/15 rounded-md text-[#08184B]"
                      >
                        <span className="truncate max-w-[160px]">{f.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setIntakeFiles((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Remove ${f.fileName}`}
                          className="text-[#A81C1C] cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={starting}
                className="w-full py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg cursor-pointer"
              >
                {starting ? 'Creating Ticket & Opening Chat...' : `Enter Support Chat (${activeTicketNo})`}
              </button>
            </form>
          ) : (
            /* Single Persistent 1-to-1 Conversational Thread */
            <>
              <div className="px-4 py-2 bg-[#FAF8F4] border-b border-[#08184B]/10 flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-[#08184B] truncate">
                  {thread.customerName} · {thread.status}
                </span>
                <span className="text-[#08184B]/70 whitespace-nowrap">
                  {supportAvailable ? 'Human Support Online' : 'Support Busy · AI Active'}
                </span>
              </div>

              {error && (
                <div role="alert" className="mx-3 mt-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  {error}
                </div>
              )}

              {aiNotice && (
                <div className="mx-3 mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <Bot className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{aiNotice}</span>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAF8F4] min-h-[260px]">
                {thread.messages.map((msg) => {
                  const isCustomer = msg.senderRole === 'customer';
                  const isAi = msg.senderRole === 'ai';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isCustomer ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs space-y-1.5 ${
                          isCustomer
                            ? 'bg-[#08184B] text-white'
                            : isAi
                            ? 'bg-white text-[#08184B] border border-[#D9A726]/50'
                            : 'bg-white text-[#08184B] border border-emerald-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] opacity-80">
                          <span className="font-semibold flex items-center gap-1">
                            {isAi && <Bot className="h-3 w-3 text-[#C89212]" aria-hidden="true" />}
                            {!isCustomer && !isAi && (
                              <CheckCircle2 className="h-3 w-3 text-emerald-700" aria-hidden="true" />
                            )}
                            <span>{msg.senderDisplayName}</span>
                          </span>
                          <span className="tabular-nums whitespace-nowrap">
                            {formatMessageDateTime(msg.sentAt)}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="pt-1 space-y-1.5">
                            {msg.attachments.map((att, idx) => (
                              <div key={idx}>
                                {att.mimeType.startsWith('image/') ? (
                                  <a href={att.url} target="_blank" rel="noreferrer" className="block">
                                    <img
                                      src={att.url}
                                      alt={att.fileName}
                                      className="max-h-36 rounded-lg border border-black/10 object-cover"
                                    />
                                  </a>
                                ) : (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-1 underline ${
                                      isCustomer ? 'text-[#EAB308]' : 'text-[#08184B]'
                                    }`}
                                  >
                                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                    <span>{att.fileName}</span>
                                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Conversational Chat Composer with File / Photo Upload */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#08184B]/12 space-y-2">
                {composerFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {composerFiles.map((f, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-[#FAF8F4] border border-[#08184B]/15 rounded text-[#08184B]"
                      >
                        <span className="truncate max-w-[140px]">{f.fileName}</span>
                        <button
                          type="button"
                          onClick={() => setComposerFiles((prev) => prev.filter((_, i) => i !== idx))}
                          aria-label={`Remove ${f.fileName}`}
                          className="text-[#A81C1C] cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <label
                    title="Attach file or photo (max 2)"
                    className="p-2 text-[#08184B]/70 hover:text-[#08184B] bg-[#FAF8F4] border border-[#08184B]/15 rounded-lg cursor-pointer shrink-0"
                  >
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      disabled={composerFiles.length >= MAX_CHAT_ATTACHMENTS}
                      onChange={(e) => handleAttachFiles(e, setComposerFiles, composerFiles.length)}
                      className="sr-only"
                    />
                  </label>

                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 text-xs bg-[#FAF8F4] border border-[#08184B]/15 rounded-lg focus:outline-none focus:border-[#08184B]"
                  />

                  <button
                    type="submit"
                    disabled={sending || (!messageText.trim() && composerFiles.length === 0)}
                    aria-label="Send message"
                    className="p-2 text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
