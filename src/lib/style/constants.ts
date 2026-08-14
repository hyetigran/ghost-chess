// Mirrors the design tokens in global.css (bg / border / card / danger /
// accent / ink) so React Navigation chrome matches the themed app surface.
// Hex values are the mockup's raw palette — keep in sync with --dt-* there.
export const NAV_THEME = {
  light: {
    background: 'hsl(45 20% 96.1%)', // --dt-bg #F7F6F3
    border: 'hsl(44 16% 86.9%)', // --dt-border #E3E0D8
    card: 'hsl(45 20% 96.1%)', // headers sit on bg, not raised cards
    notification: 'hsl(6 60% 48.4%)', // --dt-danger #C63F31
    primary: 'hsl(101 35% 35.5%)', // --dt-accent #4F7A3B
    text: 'hsl(45 8% 9.8%)', // --dt-ink #1B1A17
  },
  dark: {
    background: 'hsl(210 13% 9%)', // --dt-bg #14171A
    border: 'hsl(212 13% 19%)', // --dt-border #2A3037
    card: 'hsl(210 13% 9%)', // headers sit on bg, not raised cards
    notification: 'hsl(8 69% 62.9%)', // --dt-danger #E2705F
    primary: 'hsl(96 36% 46.7%)', // --dt-accent #6FA24C
    text: 'hsl(90 6% 92.9%)', // --dt-ink #EDEEEC
  },
};
