// SafetyWalk brand palette.
// A calm "trust" navy is the base, with a hot coral reserved ONLY for danger/SOS
// actions so it always stands out, and a mint/green for "safe" states.
export const Colors = {
  bg: '#0B1226',        // app background (deep navy, feels secure at night)
  bgAlt: '#121B36',     // card background
  bgSoft: '#1B2547',    // input / soft surface
  border: '#26305A',
  primary: '#5B8CFF',   // trust blue - primary actions, links
  primaryDark: '#3E63D6',
  accent: '#38E1C6',    // mint - "safe", success, positive status
  danger: '#FF4D5E',    // coral red - SOS / danger ONLY
  dangerDark: '#E23545',
  warning: '#FFB648',   // amber - warnings / countdowns
  text: '#F5F7FF',
  textMuted: '#9AA4C7',
  textFaint: '#6B7597',
  white: '#FFFFFF',
};

export const Radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 10,
  }),
};
