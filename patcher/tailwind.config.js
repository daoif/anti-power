/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Match Antigravity's dark palette
                'ag-bg': '#0d0d0d',
                'ag-surface': '#1a1a1a',
                'ag-surface-2': '#252525',
                'ag-border': '#333333',
                'ag-text': '#ffffff',
                'ag-text-secondary': '#a0a0a0',
                'ag-accent': '#4a9eff',
                'ag-accent-hover': '#6ab0ff',
                'ag-success': '#22c55e',
                'ag-warning': '#f59e0b',
                'ag-error': '#ef4444',
            },
        },
    },
    plugins: [],
}
