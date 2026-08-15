import React from 'react';
import { NotificationsView } from '../src/components/NotificationsView';

/**
 * Stack route for notifications — the target of push-notification deep links
 * and the drawer entry, where a back button is expected. The tab version at
 * /(tabs)/alerts renders the same view without one.
 */
export default function NotificationsScreen() {
  return <NotificationsView withBack />;
}
