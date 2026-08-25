import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './core/lib/AuthContext';
import { UiProvider } from './core/lib/UiContext';
import { registerServiceWorker } from './core/lib/pushNotifications';

import './styles/base.css';
import './styles/themes.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/app-extra.css';

// Früh registrieren (nicht erst beim Klick auf "Aktivieren" in Profile.jsx)
// — der Worker muss laufen, bevor überhaupt ein Push-Abo möglich ist.
// Fragt noch KEINE Berechtigung an, das passiert erst explizit im Profil.
registerServiceWorker().catch(() => { /* Browser ohne Service-Worker-Unterstützung */ });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </UiProvider>
  </React.StrictMode>
);
