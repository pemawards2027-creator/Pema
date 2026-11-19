import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { usePema } from '../context/PemaContext';
import { BrandMark } from './BrandMark';

interface FooterProps {
  onNavigate: (path: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const { liveContent } = usePema();
  const contactNumber = liveContent?.settings?.contactNumber || '0924-173-7587';
  const contactEmail = liveContent?.settings?.contactEmail || 'pem.awards2027@gmail.com';
  const orgNote =
    liveContent?.settings?.organizationNote ||
    'Program details, venue, and fees subject to committee confirmation.';

  const go = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer className="no-print bg-[#08184B] text-white border-t border-[#D9A726]/25">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/15">
          <div className="md:col-span-5 space-y-4">
            <a href="/" onClick={go('/')} className="inline-block">
              <BrandMark variant="dark" showSubtitle />
            </a>
            <p className="text-sm text-white/75 max-w-sm leading-relaxed">
              Celebrating Filipino excellence with distinction, purpose, and pride across leadership,
              enterprise, public service, culture, and community impact.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#D9A726]">
              Explore
            </p>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li>
                <a href="/about" onClick={go('/about')} className="hover:text-[#D9A726] transition-colors">
                  About PEMA
                </a>
              </li>
              <li>
                <a href="/services" onClick={go('/services')} className="hover:text-[#D9A726] transition-colors">
                  Our services
                </a>
              </li>
              <li>
                <a href="/pricing" onClick={go('/pricing')} className="hover:text-[#D9A726] transition-colors">
                  Program pricing
                </a>
              </li>
              <li>
                <a href="/nominate" onClick={go('/nominate')} className="hover:text-[#D9A726] transition-colors">
                  Submit nomination
                </a>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <p className="text-xs font-semibold tracking-[0.16em] uppercase text-[#D9A726]">
              Secretariat &amp; Portal
            </p>
            <ul className="space-y-2.5 text-sm text-white/80">
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 text-[#D9A726] shrink-0" aria-hidden="true" />
                <a href={`tel:${contactNumber}`} className="tabular-nums hover:text-[#D9A726] transition-colors">
                  {contactNumber}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-[#D9A726] shrink-0" aria-hidden="true" />
                <a href={`mailto:${contactEmail}`} className="hover:text-[#D9A726] transition-colors break-all">
                  {contactEmail}
                </a>
              </li>
              <li>
                <a href="/contact" onClick={go('/contact')} className="hover:text-[#D9A726] transition-colors">
                  Contact Secretariat Team
                </a>
              </li>
              <li className="pt-2">
                <a
                  href="/admin"
                  onClick={go('/admin')}
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#D9A726] hover:text-[#F3D16B] transition-colors"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Administrator Dashboard</span>
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-white/60">
          <p>© 2026–2027 Philippine Excellency and Merit Awards (PEMA)</p>
          <p className="text-white/55">{orgNote}</p>
        </div>
      </div>
    </footer>
  );
}
