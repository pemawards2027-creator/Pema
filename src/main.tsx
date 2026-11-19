import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onRegisterError() {
    // Gracefully ignore SW registration issues in restricted browser contexts
  },
});

createRoot(document.getElementById('root')!).render(<App />);
