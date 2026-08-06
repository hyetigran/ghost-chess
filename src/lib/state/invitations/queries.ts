import { queryOptions } from '@tanstack/react-query';
import {
  getMyOpenInvitations,
  getOpenInvitations,
} from '~/api/server/invitations';

// Both scoped by the caller's own auth session (get_open_invitations()/
// get_my_open_invitations() read auth.uid() server-side, not a userId
// parameter), but still keyed by userId here — same reason every other
// query in this codebase includes it (userQueries, src/lib/state/user/
// queries.ts): so a signed-out-then-signed-in-as-someone-else session
// doesn't serve stale cached data for the wrong user.
export const invitationQueries = {
  open: (viewerId: string) =>
    queryOptions({
      queryKey: ['invitations', 'open', viewerId],
      queryFn: () => getOpenInvitations(),
      enabled: !!viewerId,
    }),
  mine: (viewerId: string) =>
    queryOptions({
      queryKey: ['invitations', 'mine', viewerId],
      queryFn: () => getMyOpenInvitations(),
      enabled: !!viewerId,
    }),
};
