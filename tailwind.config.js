/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  'var(--brand-50)',
          100: 'var(--brand-100)',
          200: 'var(--brand-200)',
          300: 'var(--brand-300)',
          400: 'var(--brand-400)',
          500: 'var(--brand-500)',
          600: 'var(--brand-600)',
          700: 'var(--brand-700)',
          800: 'var(--brand-800)',
          900: 'var(--brand-900)',
        },
        accent: {
          300: 'var(--accent-300)',
          400: 'var(--accent-400)',
          500: 'var(--accent-500)',
          600: 'var(--accent-600)',
          700: 'var(--accent-700)',
        },
        success: {
          50:  'var(--success-50)',
          100: 'var(--success-100)',
          500: 'var(--success-500)',
          600: 'var(--success-600)',
          700: 'var(--success-700)',
        },
        warning: {
          50:  'var(--warning-50)',
          100: 'var(--warning-100)',
          500: 'var(--warning-500)',
          600: 'var(--warning-600)',
          700: 'var(--warning-700)',
        },
        error: {
          50:  'var(--error-50)',
          100: 'var(--error-100)',
          500: 'var(--error-500)',
          600: 'var(--error-600)',
          700: 'var(--error-700)',
        },
        info: {
          50:  'var(--info-50)',
          100: 'var(--info-100)',
          500: 'var(--info-500)',
          600: 'var(--info-600)',
          700: 'var(--info-700)',
        },
        gray: {
          50:  'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
        },
      },
      fontFamily: {
        sans: ['var(--font-text)'],
        heading: ['var(--font-heading)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        xs:   ['14px', '20px'],
        sm:   ['16px', '24px'],
        base: ['18px', '28px'],
        lg:   ['20px', '30px'],
        xl:   ['24px', '32px'],
        '2xl': ['28px', '36px'],
        '3xl': ['32px', '40px'],
      },
      borderRadius: {
        sm:   'var(--radius-sm)',
        DEFAULT: 'var(--radius-base)',
        md:   'var(--radius-md)',
        lg:   'var(--radius-lg)',
        xl:   'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      screens: {
        // Desktop-first audience; sm/md/lg correspond to laptop sizes.
        // 1366px is the minimum target resolution (DESIGN_SYSTEM.md).
        xs: '320px',
        sm: '640px',
        md: '1024px',
        lg: '1280px',
        xl: '1536px',
      },
      minHeight: {
        button: 'var(--size-button)',
        input: 'var(--size-input)',
        row: 'var(--size-row)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    // Disable Tailwind's preflight — Taiga UI has its own reset.
    preflight: false,
  },
};
