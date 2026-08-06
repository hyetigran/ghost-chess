import {
  describeLocalGameResult,
  localGameOutcomeHeading,
  localGameOutcomeTone,
} from '~/lib/game/local-game-result-text';

describe('describeLocalGameResult', () => {
  it('names the winning side on king capture', () => {
    expect(describeLocalGameResult('king_captured', 'white')).toBe(
      'White wins by capturing the king!',
    );
    expect(describeLocalGameResult('king_captured', 'black')).toBe(
      'Black wins by capturing the king!',
    );
  });

  it('describes a plain draw', () => {
    expect(describeLocalGameResult('draw', null)).toBe('Draw.');
  });
});

describe('localGameOutcomeTone', () => {
  it('is positive when the viewer color won', () => {
    expect(localGameOutcomeTone('king_captured', 'white', 'white')).toBe(
      'positive',
    );
  });

  it('is negative when the other color won', () => {
    expect(localGameOutcomeTone('king_captured', 'black', 'white')).toBe(
      'negative',
    );
  });

  it('is neutral for a draw, regardless of viewer color', () => {
    expect(localGameOutcomeTone('draw', null, 'white')).toBe('neutral');
  });
});

describe('localGameOutcomeHeading', () => {
  it('reads "You Won" / "You Lost" relative to the viewer color', () => {
    expect(localGameOutcomeHeading('king_captured', 'white', 'white')).toBe(
      'You Won',
    );
    expect(localGameOutcomeHeading('king_captured', 'black', 'white')).toBe(
      'You Lost',
    );
  });

  it('reads "Draw" for a draw', () => {
    expect(localGameOutcomeHeading('draw', null, 'white')).toBe('Draw');
  });
});
