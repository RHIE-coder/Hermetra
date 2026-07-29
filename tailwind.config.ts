import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        canvas: 'hsl(var(--canvas) / <alpha-value>)',
        sidebar: 'hsl(var(--sidebar) / <alpha-value>)',
        topbar: 'hsl(var(--topbar) / <alpha-value>)',
        placeholder: 'hsl(var(--placeholder) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        // Module markers and state signals — text-safe in both themes, never
        // used as a card tint. See the note in global.css.
        web: 'hsl(var(--accent-web) / <alpha-value>)',
        mobile: 'hsl(var(--accent-mobile) / <alpha-value>)',
        bridge: 'hsl(var(--accent-bridge) / <alpha-value>)',
        danger: 'hsl(var(--danger) / <alpha-value>)',
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        c1: 'hsl(var(--c1) / <alpha-value>)',
        c2: 'hsl(var(--c2) / <alpha-value>)',
        c3: 'hsl(var(--c3) / <alpha-value>)',
        c4: 'hsl(var(--c4) / <alpha-value>)',
        c5: 'hsl(var(--c5) / <alpha-value>)',
        c6: 'hsl(var(--c6) / <alpha-value>)',
      },
      borderRadius: {
        // `xl` is mapped too: Card ships with rounded-xl, and a radius token
        // that some components ignore is not a token.
        xl: 'var(--radius)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 0.1875rem)',
        sm: 'calc(var(--radius) - 0.375rem)',
      },
      // Roles, not sizes: sm = a control sits on the panel, DEFAULT = a panel
      // sits on the field, md = the one raised panel per screen, lg = it floats
      // (menu, dialog), inner = a well carved into the panel.
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        inner: 'var(--shadow-inner)',
        none: 'none',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
