import React from 'react';
import { NotificationsView } from '../../src/components/NotificationsView';

/**
 * Alerts tab. Took the bottom-bar slot Profile vacated, because notifications
 * previously lived only in the Community header and were unreachable from any
 * other tab.
 */
export default function AlertsTab() {
  return <NotificationsView />;
}
