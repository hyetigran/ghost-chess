import * as React from 'react';
import {
  reduceMoveConfirmation,
  type MoveConfirmationEvent,
  type MoveConfirmationState,
  type PendingMove,
} from '~/lib/game/move-confirmation';

type UseMoveConfirmationResult = {
  pendingMove: PendingMove | null;
  attemptMove: (move: PendingMove) => void;
  confirm: () => void;
  cancel: () => void;
};

// Thin state wrapper around reduceMoveConfirmation — no logic of its own,
// see src/lib/game/move-confirmation.test.ts for the tested behavior.
export function useMoveConfirmation(
  confirmationEnabled: boolean,
  onSubmit: (move: PendingMove) => void,
): UseMoveConfirmationResult {
  const [state, setState] = React.useState<MoveConfirmationState>({
    pending: null,
  });

  const dispatch = (event: MoveConfirmationEvent): void => {
    const result = reduceMoveConfirmation(state, event);
    setState(result.state);
    if (result.toSubmit) onSubmit(result.toSubmit);
  };

  const attemptMove = (move: PendingMove): void =>
    dispatch({ type: 'attempt', move, confirmationEnabled });

  const confirm = (): void => dispatch({ type: 'confirm' });

  const cancel = (): void => dispatch({ type: 'cancel' });

  return { pendingMove: state.pending, attemptMove, confirm, cancel };
}
