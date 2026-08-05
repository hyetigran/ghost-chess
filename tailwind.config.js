const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
          alt: 'hsl(var(--dt-card-alt))',
        },
        // Raw design tokens (Chess Game App Mockups/design_handoff_chess_game)
        // not already covered by a shadcn slot above.
        boardBg: 'hsl(var(--dt-board-bg))',
        borderStrong: 'hsl(var(--dt-border-strong))',
        faint: 'hsl(var(--dt-faint))',
        accentPressed: 'hsl(var(--dt-accent-pressed))',
        accentDisabled: 'hsl(var(--dt-accent-disabled))',
        danger: 'hsl(var(--dt-danger))',
        highlight: 'hsl(var(--dt-highlight))',
        squareLight: 'hsl(var(--dt-square-light))',
        squareDark: 'hsl(var(--dt-square-dark))',
        fog: 'hsl(var(--dt-fog))',
        pieceWhite: 'hsl(var(--dt-piece-white))',
        pieceBlack: 'hsl(var(--dt-piece-black))',
        sheet: 'hsl(var(--dt-sheet, var(--dt-card)))',
      },
      fontFamily: {
        sans: ['Manrope_500Medium'],
        'sans-medium': ['Manrope_500Medium'],
        'sans-semibold': ['Manrope_600SemiBold'],
        'sans-bold': ['Manrope_700Bold'],
        'sans-extrabold': ['Manrope_800ExtraBold'],
        mono: ['IBMPlexMono_500Medium'],
        'mono-semibold': ['IBMPlexMono_600SemiBold'],
      },
      borderRadius: {
        tile: '12px',
        strip: '14px',
        chip: '16px',
        control: '18px',
        sheet: '30px',
        shell: '38px',
        pill: '9999px',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
