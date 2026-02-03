/**
 * @type {import('tailwindcss').Config}
 */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Match Antigravity's dark surfaces
                'ag-bg': 'rgb(24, 24, 24)',
                'ag-surface': 'rgb(31, 31, 31)',
                'ag-surface-2': 'rgb(36, 36, 36)',
                'ag-surface-3': 'rgb(42, 42, 42)',
                'ag-surface-elevated': 'rgb(38, 38, 38)',

                'ag-border': 'rgba(255, 255, 255, 0.08)',
                'ag-border-hover': 'rgba(255, 255, 255, 0.15)',
                'ag-border-glow': 'rgba(51, 118, 205, 0.3)',

                'ag-text': 'rgb(204, 204, 204)',
                'ag-text-strong': 'rgb(255, 255, 255)',
                'ag-text-secondary': 'rgba(204, 204, 204, 0.82)',
                'ag-text-tertiary': 'rgba(204, 204, 204, 0.62)',
                'ag-text-muted': 'rgba(204, 204, 204, 0.46)',

                'ag-accent': 'rgb(51, 118, 205)',
                'ag-accent-hover': 'rgb(71, 138, 225)',
                'ag-accent-active': 'rgb(41, 108, 195)',
                'ag-accent-subtle': 'rgba(51, 118, 205, 0.1)',
                'ag-accent-glow': 'rgba(51, 118, 205, 0.25)',

                'ag-success': 'rgb(34, 197, 94)',
                'ag-success-subtle': 'rgba(34, 197, 94, 0.1)',
                'ag-warning': 'rgb(245, 158, 11)',
                'ag-warning-subtle': 'rgba(245, 158, 11, 0.1)',
                'ag-error': 'rgb(239, 68, 68)',
                'ag-error-subtle': 'rgba(239, 68, 68, 0.1)',
            },
            borderRadius: {
                'sm': '6px',
                'md': '10px',
                'lg': '14px',
                'xl': '18px',
                '2xl': '24px',
            },
            boxShadow: {
                'ag-sm': '0 1px 2px rgba(0, 0, 0, 0.3)',
                'ag-md': '0 4px 12px rgba(0, 0, 0, 0.35)',
                'ag-lg': '0 8px 24px rgba(0, 0, 0, 0.4)',
                'ag-xl': '0 20px 40px rgba(0, 0, 0, 0.5), 0 8px 16px rgba(0, 0, 0, 0.3)',
                'ag-accent': '0 4px 20px rgba(51, 118, 205, 0.2)',
                'ag-accent-lg': '0 8px 32px rgba(51, 118, 205, 0.25)',
                'ag-card': '0 18px 44px rgba(0, 0, 0, 0.36), 0 1px 0 rgba(255, 255, 255, 0.04) inset',
            },
            transitionTimingFunction: {
                'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
                'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out forwards',
                'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'card-enter': 'card-enter 0.35s cubic-bezier(0.16, 1, 0.3, 1) backwards',
            },
        },
    },
    plugins: [],
}
