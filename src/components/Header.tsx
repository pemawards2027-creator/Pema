import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { usePema } from '../context/PemaContext';
import { BrandMark } from './BrandMark';

interface HeaderProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const NAV_LINKS = [
  { label: 'About', path: '/about' },
  { label: 'Services', path: '/services' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'FAQ', path: '/faq' },
  { label: 'Contact', path: '/contact' },
];

export function Header({ currentPath, onNavigate }: HeaderProps) {
  const { user, isAdmin } = usePema();
  const [mobileOpen, setMobileOpen] = useState(false);

  const go = (path: string) => {
    setMobileOpen(false);
    onNavigate(path);
  };

  const primaryCtaPath = user ? '/account' : isAdmin ? '/admin' : '/signup';
  const primaryCtaLabel = user ? 'My Account' : isAdmin ? 'Admin Console' : 'Join PEMA';

  return (
    <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#08184B]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Lockup (single-line, official PEMA crest + wordmark) */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go('/');
          }}
          aria-label="Philippine Excellency and Merit Awards Home"
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9A726] rounded-md shrink-0"
        >
          <BrandMark variant="header" />
        </a>

        {/* Zone 2: Clean single-line navigation links */}
        <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((item) => {
            const active = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  go(item.path);
                }}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 ${
                  active
                    ? 'text-[#08184B] border-[#D9A726] font-semibold'
                    : 'text-[#08184B]/70 border-transparent hover:text-[#08184B] hover:border-[#D9A726]/50'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => go(primaryCtaPath)}
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9A726]"
          >
            {primaryCtaLabel}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
            className="lg:hidden inline-flex items-center justify-center h-11 w-11 rounded-lg text-[#08184B] hover:bg-[#08184B]/5 cursor-pointer"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-[#08184B]/10 px-4 py-4 space-y-1">
          {NAV_LINKS.map((item) => {
            const active = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  go(item.path);
                }}
                className={`flex items-center min-h-[44px] px-3 rounded-lg text-base font-medium ${
                  active
                    ? 'bg-[#08184B]/5 text-[#08184B] font-semibold'
                    : 'text-[#08184B]/80 hover:bg-[#08184B]/5'
                }`}
              >
                {item.label}
              </a>
            );
          })}
          <div className="pt-3 border-t border-[#08184B]/10 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => go('/nominate')}
              className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold text-[#08184B] bg-[#D9A726] hover:bg-[#C6951D] rounded-lg cursor-pointer"
            >
              Submit Nomination
            </button>
            <button
              type="button"
              onClick={() => go(primaryCtaPath)}
              className="w-full min-h-[44px] px-4 py-2.5 text-sm font-semibold text-white bg-[#08184B] hover:bg-[#0D2570] rounded-lg cursor-pointer"
            >
              {primaryCtaLabel}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
