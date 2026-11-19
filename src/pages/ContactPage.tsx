import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { useState } from 'react';
import { OfficialSealMedallion } from '../components/BrandMark';
import { usePema } from '../context/PemaContext';
import { apiFetch } from '../utils/api';

export function ContactPage() {
  const { liveContent } = usePema();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('Nomination & Program Inquiry');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const contact = liveContent?.contact ?? {
    eyebrow: 'Contact PEMA',
    titlePrefix: 'Let’s talk',
    titleEmphasis: 'excellence.',
    subtitle: 'Questions about nominations, partnerships, or the program? We’d love to hear from you.',
    responseNote: 'Secretariat Desk · 0924-173-7587 · pem.awards2027@gmail.com',
  };

  const contactNumber = liveContent?.settings.contactNumber || '0924-173-7587';
  const contactEmail = liveContent?.settings.contactEmail || 'pem.awards2027@gmail.com';
  const officeLocation =
    liveContent?.settings.officeLocation || 'Metro Manila, Philippines (Secretariat venue to be confirmed)';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FAF8F4]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5 space-y-6">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-[#A81C1C]">
              {contact.eyebrow}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-[#08184B] leading-tight text-balance">
              {contact.titlePrefix}{' '}
              <em className="italic font-semibold text-[#C89212]">{contact.titleEmphasis}</em>
            </h1>
            <p className="text-lg text-[#08184B]/80 leading-relaxed">{contact.subtitle}</p>

            <div className="bg-[#08184B] text-white rounded-2xl p-7 space-y-5 border border-[#D9A726]/30">
              <div className="flex items-center gap-4">
                <OfficialSealMedallion size="sm" />
                <div>
                  <p className="text-xs font-semibold tracking-[0.15em] uppercase text-[#D9A726]">
                    Official Secretariat
                  </p>
                  <p className="font-display text-lg font-semibold">PEMA Desk</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/85 border-t border-white/15 pt-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-[#D9A726] shrink-0" aria-hidden="true" />
                  <span className="tabular-nums font-medium">{contactNumber}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-[#D9A726] shrink-0" aria-hidden="true" />
                  <span className="font-medium break-all">{contactEmail}</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-[#D9A726] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{officeLocation}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="bg-white border border-[#08184B]/12 rounded-2xl p-7 sm:p-9">
              {submitted ? (
                <div className="py-10 text-center space-y-4">
                  <CheckCircle2 className="h-12 w-12 text-emerald-700 mx-auto" aria-hidden="true" />
                  <h2 className="font-display text-2xl font-bold text-[#08184B]">
                    Message received by PEMA Secretariat
                  </h2>
                  <p className="text-sm text-[#08184B]/75 max-w-md mx-auto">
                    Thank you for reaching out. Our team will respond via {contactEmail} or{' '}
                    {contactNumber}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                  <h2 className="font-display text-2xl font-bold text-[#08184B]">
                    Send an inquiry
                  </h2>

                  {error && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800"
                    >
                      {error}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-name" className="block text-sm font-medium text-[#08184B] mb-1.5">
                        Name *
                      </label>
                      <input
                        id="contact-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="block text-sm font-medium text-[#08184B] mb-1.5">
                        Email *
                      </label>
                      <input
                        id="contact-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contact-phone" className="block text-sm font-medium text-[#08184B] mb-1.5">
                        Phone number
                      </label>
                      <input
                        id="contact-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09XX-XXX-XXXX"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-subject" className="block text-sm font-medium text-[#08184B] mb-1.5">
                        Topic
                      </label>
                      <select
                        id="contact-subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                      >
                        <option value="Nomination & Program Inquiry">Nomination &amp; Program Inquiry</option>
                        <option value="Fee & Payment Clarification">Fee &amp; Payment Clarification</option>
                        <option value="Organizational Partnership">Organizational Partnership</option>
                        <option value="Press & Media">Press &amp; Media</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="contact-message" className="block text-sm font-medium text-[#08184B] mb-1.5">
                      Message *
                    </label>
                    <textarea
                      id="contact-message"
                      rows={4}
                      required
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="How can the PEMA Secretariat assist you?"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#08184B]/20 rounded-lg focus:outline-none focus:border-[#08184B]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                    <p className="text-xs text-[#08184B]/60">{contact.responseNote}</p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 py-3 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] disabled:opacity-60 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {submitting ? 'Sending...' : 'Send message'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
