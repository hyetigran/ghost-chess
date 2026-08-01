export type PendingMove = { from: string; to: string; promotion: string };

export type MoveConfirmationState = { pending: PendingMove | null };

export type MoveConfirmationEvent =
  | { type: 'attempt'; move: PendingMove; confirmationEnabled: boolean }
  | { type: 'confirm' }
  | { type: 'cancel' };

export type MoveConfirmationResult = {
  state: MoveConfirmationState;
  toSubmit: PendingMove | null;
};

// Pure decision logic for the optional "are you sure?" step (#22, ADR-0007).
// Deliberately never inspects legality or talks to the server — reusing the
// single move-submission path (moves are only ever handed back via
// `toSubmit`) is what keeps this from becoming a second oracle a player
// could use to probe hidden squares.
export function reduceMoveConfirmation(
  state: MoveConfirmationState,
  event: MoveConfirmationEvent,
): MoveConfirmationResult {
  switch (event.type) {
    case 'attempt':
      if (!event.confirmationEnabled)
        return { state: { pending: null }, toSubmit: event.move };
      return { state: { pending: event.move }, toSubmit: null };
    case 'confirm':
      if (!state.pending) return { state, toSubmit: null };
      return { state: { pending: null }, toSubmit: state.pending };
    case 'cancel':
      return { state: { pending: null }, toSubmit: null };
  }
}
