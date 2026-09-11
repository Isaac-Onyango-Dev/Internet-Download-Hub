import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';
import tailwindcssTypography from '@tailwindcss/typography';

export default {
  darkMode: ['class'],
  content: ['./client/index.html', './client/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      // Read off the site: icon tiles 14px, buttons 16px, disclosure panels
      // 18px, cards 22px. The old scale topped out at 9px, which is most of
      // why the app's panels read a generation older than the site.
      borderRadius: {
        sm: 'var(--app-radius-sm)' /* 10px */,
        md: 'var(--app-radius-md)' /* 14px */,
        lg: 'var(--app-radius-lg)' /* 18px */,
        xl: 'var(--app-radius-xl)' /* 22px */,
        '2xl': '28px',
      },
      colors: {
        // Flat / base colors (regular buttons)
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        'border-lift': 'hsl(var(--app-border-lift) / <alpha-value>)',
        surface: 'hsl(var(--app-surface) / <alpha-value>)',
        'surface-lift': 'hsl(var(--app-surface-lift) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
          border: 'hsl(var(--card-border) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
          border: 'hsl(var(--popover-border) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
          border: 'var(--primary-border)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
          border: 'var(--secondary-border)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
          border: 'var(--muted-border)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
          border: 'var(--accent-border)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
          border: 'var(--destructive-border)',
        },
        ring: 'hsl(var(--ring) / <alpha-value>)',
        chart: {
          '1': 'hsl(var(--chart-1) / <alpha-value>)',
          '2': 'hsl(var(--chart-2) / <alpha-value>)',
          '3': 'hsl(var(--chart-3) / <alpha-value>)',
          '4': 'hsl(var(--chart-4) / <alpha-value>)',
          '5': 'hsl(var(--chart-5) / <alpha-value>)',
        },
        sidebar: {
          ring: 'hsl(var(--sidebar-ring) / <alpha-value>)',
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
          border: 'hsl(var(--sidebar-border) / <alpha-value>)',
        },
        'sidebar-primary': {
          DEFAULT: 'hsl(var(--sidebar-primary) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-primary-foreground) / <alpha-value>)',
          border: 'var(--sidebar-primary-border)',
        },
        'sidebar-accent': {
          DEFAULT: 'hsl(var(--sidebar-accent) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-accent-foreground) / <alpha-value>)',
          border: 'var(--sidebar-accent-border)',
        },
        // Status roles resolve to brand tokens rather than stray rgb() so
        // they cannot drift away from the site palette again.
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
        status: {
          online: 'hsl(var(--success) / <alpha-value>)',
          away: 'hsl(var(--warning) / <alpha-value>)',
          busy: 'hsl(var(--destructive) / <alpha-value>)',
          offline: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      // The site's press/hover curve, exposed as ease-bounce / ease-brand.
      transitionTimingFunction: {
        bounce: 'var(--brand-bounce)',
        brand: 'var(--brand-ease)',
      },
      boxShadow: {
        lift: 'var(--brand-shadow-lift)',
        hot: 'var(--brand-shadow-hot)',
        'hot-lift': 'var(--brand-shadow-hot-lift)',
      },
      backgroundImage: {
        prism: 'var(--brand-prism)',
        'prism-soft': 'var(--brand-prism-soft)',
        hot: 'var(--brand-hot-grad)',
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
  plugins: [tailwindcssAnimate, tailwindcssTypography],
} satisfies Config;
