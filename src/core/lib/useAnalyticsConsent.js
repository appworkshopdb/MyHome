import { useSyncExternalStore } from 'react';
import { getConsentSnapshot, subscribeConsent } from './analytics';

// 'granted' | 'denied' | null (noch nicht gefragt) | 'pending' (Abgleich mit dem
// Server läuft noch — Banner dann noch nicht zeigen)
export function useAnalyticsConsent() {
  return useSyncExternalStore(subscribeConsent, getConsentSnapshot, () => null);
}
