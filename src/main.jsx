import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './core/lib/AuthContext';
import { UiProvider } from './core/lib/UiContext';
import { registerServiceWorker } from './core/lib/pushNotifications';
import { initAnalytics } from './core/lib/analytics';

import './styles/base.css';
import './styles/themes.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/app-extra.css';
import './styles/onboarding.css';
import './styles/wizard.css';
import './modules/finance/finance.css';

// Früh registrieren (nicht erst beim Klick auf "Aktivieren" in Profile.jsx)
// — der Worker muss laufen, bevor überhaupt ein Push-Abo möglich ist.
// Fragt noch KEINE Berechtigung an, das passiert erst explizit im Profil.
registerServiceWorker().catch(() => { /* Browser ohne Service-Worker-Unterstützung */ });

// Installiert nur die Listener; erfasst wird erst nach Einwilligung + Login.
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiProvider>
  </React.StrictMode>
);
