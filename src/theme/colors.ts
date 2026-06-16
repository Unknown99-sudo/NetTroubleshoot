// Color tokens mirroring the original Tailwind dark theme
export const colors = {
  // Backgrounds
  bg950: '#030712',
  bg900: '#111827',
  bg800: '#1f2937',
  bg800_60: 'rgba(31,41,55,0.6)',
  bg800_40: 'rgba(31,41,55,0.4)',
  bg700: '#374151',
  bg700_60: 'rgba(55,65,81,0.6)',
  bg700_40: 'rgba(55,65,81,0.4)',
  bg700_30: 'rgba(55,65,81,0.3)',
  bg700_20: 'rgba(55,65,81,0.2)',
  bg600: '#4b5563',

  // Borders
  border800: '#1f2937',
  border700: '#374151',
  border700_60: 'rgba(55,65,81,0.6)',
  border700_40: 'rgba(55,65,81,0.4)',
  border600: '#4b5563',

  // Text
  white: '#ffffff',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',

  // Accents
  blue400: '#60a5fa',
  blue500: '#3b82f6',
  blue600: '#2563eb',
  blue500_30: 'rgba(59,130,246,0.3)',
  blue500_20: 'rgba(59,130,246,0.2)',
  blue600_20: 'rgba(37,99,235,0.2)',
  blue600_30: 'rgba(37,99,235,0.3)',

  green400: '#4ade80',
  green500: '#22c55e',
  green600: '#16a34a',
  green500_30: 'rgba(34,197,94,0.3)',
  green500_20: 'rgba(34,197,94,0.2)',
  green500_10: 'rgba(34,197,94,0.1)',

  yellow400: '#facc15',
  yellow500: '#eab308',
  yellow500_30: 'rgba(234,179,8,0.3)',
  yellow500_20: 'rgba(234,179,8,0.2)',
  yellow500_10: 'rgba(234,179,8,0.1)',
  yellow100_80: 'rgba(254,249,195,0.8)',

  red400: '#f87171',
  red500: '#ef4444',
  red600: '#dc2626',
  red500_30: 'rgba(239,68,68,0.3)',
  red500_20: 'rgba(239,68,68,0.2)',
  red500_10: 'rgba(239,68,68,0.1)',

  purple400: '#c084fc',
  purple500: '#a855f7',
  purple600: '#9333ea',
  purple500_30: 'rgba(168,85,247,0.3)',
  purple500_20: 'rgba(168,85,247,0.2)',

  cyan400: '#22d3ee',

  black50: 'rgba(0,0,0,0.5)',
};

export const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: colors.blue500_20, text: '#93c5fd', border: colors.blue500_30 },
  green: { bg: colors.green500_20, text: '#86efac', border: colors.green500_30 },
  yellow: { bg: colors.yellow500_20, text: '#fde047', border: colors.yellow500_30 },
  red: { bg: colors.red500_20, text: '#fca5a5', border: colors.red500_30 },
  purple: { bg: colors.purple500_20, text: '#d8b4fe', border: colors.purple500_30 },
  gray: { bg: 'rgba(107,114,128,0.2)', text: '#d1d5db', border: 'rgba(107,114,128,0.3)' },
  cyan: { bg: 'rgba(34,211,238,0.2)', text: '#67e8f9', border: 'rgba(34,211,238,0.3)' },
};
