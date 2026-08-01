import * as React from 'react';
import {
  reduceMoveConfirmation,
  type MoveConfirmationState,
  type PendingMove,
} from '~/lib/game/move-confirmation';

// Thin state wrapper around reduceMoveConfirmation — no logic of its own,
// see src/lib/game/move-confirmation.test.ts for the tested behavior.
export function useMoveConfirmation(
  confirmationEnabled: boolean,
  onSubmit: (move: PendingMove) => void,
) {
  const [state, setState] = React.useState<MoveConfirmationState>({
    pending: null,
  });

  const attemptMove = (move: PendingMove): void => {
    const result = reduceMoveConfirmation(state, {
      type: 'attempt',
      move,
      confirmationEnabled,
    });
    setState(result.state);
    if (result.toSubmit) onSubmit(result.toSubmit);
  };

  const confirm = (): void => {
    const result = reduceMoveConfirmation(state, { type: 'confirm' });
    setState(result.state);
    if (result.toSubmit) onSubmit(result.toSubmit);
  };

  const cancel = (): void => {
    const result = reduceMoveConfirmation(state, { type: 'cancel' });
    setState(result.state);
  };

  return { pendingMove: state.pending, attemptMove, confirm, cancel };
}
