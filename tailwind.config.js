/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  // Hover styles only on devices with a real pointer, so a tapped button on a
  // phone doesn't stay in its hover look.
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/lib/**/*.{js,ts,jsx,tsx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-nunito)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          accent: "#4f9d6e",
          "accent-dark": "#2f7a52",
          "accent-bg": "#eaf3ec",
          "accent-bg-light": "#f3faf4",
          "stat-bg": "#f7faf7",
          track: "#e0efe3",
          "track-alt": "#d7ebdc",
          "today-border": "#d8e8dc",
          ink: "#1c2b22",
          "ink-alt": "#20261f",
          secondary: "#63706a",
          tertiary: "#75837b",
          muted: "#9aa79f",
          disabled: "#b6bdb8",
          "icon-muted": "#c7d0ca",
          "app-bg": "#f7f6f3",
          "app-bg-alt": "#fbfbf9",
          "card-border": "#ececec",
          divider: "#f2f2ef",
          "divider-alt": "#f0f0ee",
          "input-border": "#e5e5e2",
          "chip-neutral": "#f2f1ee",
          warn: "#c98a2e",
          red: "#d64545",
          orange: "#e0a72e",
          purple: "#8a6fc7",
          brown: "#b08b5c",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};
