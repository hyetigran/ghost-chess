import { decideSelectionAction } from '~/lib/game/selection';

describe('decideSelectionAction', () => {
  it('selects an own piece when nothing is currently selected', () => {
    expect(decideSelectionAction(null, 'e2', 'w', new Set(), 'w')).toEqual({
      type: 'select',
      square: 'e2',
    });
  });

  it('does nothing when tapping an empty square with nothing selected', () => {
    expect(
      decideSelectionAction(null, 'e4', undefined, new Set(), 'w'),
    ).toEqual({ type: 'noop' });
  });

  it("does nothing when tapping the opponent's piece with nothing selected", () => {
    expect(decideSelectionAction(null, 'e7', 'b', new Set(), 'w')).toEqual({
      type: 'noop',
    });
  });

  it('deselects when tapping the already-selected square again', () => {
    expect(
      decideSelectionAction('e2', 'e2', 'w', new Set(['e3', 'e4']), 'w'),
    ).toEqual({ type: 'deselect' });
  });

  it('moves when tapping a legal target while a piece is selected', () => {
    expect(
      decideSelectionAction('e2', 'e4', undefined, new Set(['e3', 'e4']), 'w'),
    ).toEqual({ type: 'move', from: 'e2', to: 'e4' });
  });

  it('re-selects instead of moving when tapping another own piece that is not a legal target', () => {
    expect(
      decideSelectionAction('e2', 'd2', 'w', new Set(['e3', 'e4']), 'w'),
    ).toEqual({ type: 'select', square: 'd2' });
  });

  it('deselects when tapping a non-legal, non-own square while a piece is selected', () => {
    expect(
      decideSelectionAction('e2', 'a7', 'b', new Set(['e3', 'e4']), 'w'),
    ).toEqual({ type: 'deselect' });
    expect(
      decideSelectionAction('e2', 'a6', undefined, new Set(['e3', 'e4']), 'w'),
    ).toEqual({ type: 'deselect' });
  });
});
