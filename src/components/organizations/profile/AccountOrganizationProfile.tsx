import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { ErrorState, LoadingState } from '../../States';
import { fetchAccountOrganization } from '../../../api/organizations';
import { OrganizationProfile } from './OrganizationProfile';

/** Account roles whose profile is an organisation, matching the server. */
export const ORG_ACCOUNT_ROLES = ['hospital', 'clinic'];

/**
 * The profile of a hospital or clinic ACCOUNT: resolves the organisation the
 * account is presented as (the server creates it on first use), then shows
 * it. The person managing the account keeps no separate public face here --
 * the page is the institution.
 */
export function AccountOrganizationProfile({ accountUserId }: { accountUserId: string }) {
  const { token } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOrgId((await fetchAccountOrganization(token, accountUserId)).id);
    } catch (e: any) {
      setError(e?.message || 'Could not load this profile.');
    }
  }, [token, accountUserId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!orgId) return <LoadingState label="Loading profile…" />;
  return <OrganizationProfile orgId={orgId} />;
}
