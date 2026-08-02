import {
  reduceMoveConfirmation,
  type MoveConfirmationState,
} from '~/lib/game/move-confirmation';

const move = { from: 'e2', to: 'e4', promotion: 'q' };
const otherMove = { from: 'd2', to: 'd4', promotion: 'q' };
const empty: MoveConfirmationState = { pending: null };

describe('reduceMoveConfirmation', () => {
  it('submits immediately when confirmation is disabled', () => {
    const result = reduceMoveConfirmation(empty, {
      type: 'attempt',
      move,
      confirmationEnabled: false,
    });

    expect(result.toSubmit).toEqual(move);
    expect(result.state.pending).toBeNull();
  });

  it('stages the move instead of submitting when confirmation is enabled', () => {
    const result = reduceMoveConfirmation(empty, {
      type: 'attempt',
      move,
      confirmationEnabled: true,
    });

    expect(result.toSubmit).toBeNull();
    expect(result.state.pending).toEqual(move);
  });

  it('replaces a staged move if the player attempts a different move first', () => {
    const staged: MoveConfirmationState = { pending: move };

    const result = reduceMoveConfirmation(staged, {
      type: 'attempt',
      move: otherMove,
      confirmationEnabled: true,
    });

    expect(result.toSubmit).toBeNull();
    expect(result.state.pending).toEqual(otherMove);
  });

  it('submits the staged move on confirm and clears staging', () => {
    const staged: MoveConfirmationState = { pending: move };

    const result = reduceMoveConfirmation(staged, { type: 'confirm' });

    expect(result.toSubmit).toEqual(move);
    expect(result.state.pending).toBeNull();
  });

  it('is a no-op to confirm when nothing is staged', () => {
    const result = reduceMoveConfirmation(empty, { type: 'confirm' });

    expect(result.toSubmit).toBeNull();
    expect(result.state.pending).toBeNull();
  });

  it('clears a staged move on cancel without submitting', () => {
    const staged: MoveConfirmationState = { pending: move };

    const result = reduceMoveConfirmation(staged, { type: 'cancel' });

    expect(result.toSubmit).toBeNull();
    expect(result.state.pending).toBeNull();
  });

  it('is a no-op to cancel when nothing is staged', () => {
    const result = reduceMoveConfirmation(empty, { type: 'cancel' });

    expect(result.toSubmit).toBeNull();
    expect(result.state.pending).toBeNull();
  });
});
