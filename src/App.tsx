import { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PemaChatSupport } from './components/PemaChatSupport';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';
import { ToastProvider } from './components/ToastProvider';
import { PemaProvider } from './context/PemaContext';
import { AboutPage } from './pages/AboutPage';
import { AccountDashboardPage } from './pages/AccountDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { AuthPage } from './pages/AuthPage';
import { ContactPage } from './pages/ContactPage';
import { FaqPage } from './pages/FaqPage';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { NominationFormPage } from './pages/NominationFormPage';
import { PricingPage } from './pages/PricingPage';
import { ServicesPage } from './pages/ServicesPage';

function PemaAppShell() {
  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const renderPage = () => {
    switch (currentPath) {
      case '/about':
        return <AboutPage onNavigate={navigate} />;
      case '/services':
        return <ServicesPage onNavigate={navigate} />;
      case '/pricing':
        return <PricingPage onNavigate={navigate} />;
      case '/gallery':
        return <GalleryPage onNavigate={navigate} />;
      case '/faq':
        return <FaqPage onNavigate={navigate} />;
      case '/contact':
        return <ContactPage />;
      case '/signup':
        return <AuthPage mode="signup" onNavigate={navigate} />;
      case '/login':
        return <AuthPage mode="login" onNavigate={navigate} />;
      case '/nominate':
        return <NominationFormPage onNavigate={navigate} />;
      case '/account':
        return <AccountDashboardPage onNavigate={navigate} />;
      case '/admin':
        return <AdminDashboardPage />;
      default:
        return <HomePage onNavigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] text-[#08184B]">
      <Header currentPath={currentPath} onNavigate={navigate} />
      <OfflineIndicator />
      <main className="flex-1">{renderPage()}</main>
      <Footer onNavigate={navigate} />
      <PemaChatSupport onNavigate={navigate} />
      <PWAInstallButton />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <PemaProvider>
        <PemaAppShell />
      </PemaProvider>
    </ToastProvider>
  );
}
