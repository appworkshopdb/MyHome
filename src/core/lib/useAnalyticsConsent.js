import { useSyncExternalStore } from 'react';
import { getConsent, subscribeConsent } from './analytics';

// 'granted' | 'denied' | null (noch nicht gefragt)
export function useAnalyticsConsent() {
  return useSyncExternalStore(subscribeConsent, getConsent, () => null);
}
