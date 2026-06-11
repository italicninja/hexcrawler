// @ts-nocheck
/**
 * ClassIcon — unique SVG icons for each D&D 5e character class.
 * All icons are 32×32 viewBox, pure inline SVG, no external deps.
 */

interface ClassIconProps {
  className: string;
  size?: number;
  color?: string;
}

// ─── Individual icon components ──────────────────────────────────────────────

const BarbarianIcon = ({ color }: { color: string }) => (
  // Greataxe: broad crescent blade + long haft
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* haft */}
    <line x1="16" y1="4" x2="16" y2="30" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    {/* broad axe head */}
    <path
      d="M16 6 C10 8 6 12 7 17 C8 20 12 21 16 20 C20 21 24 20 25 17 C26 12 22 8 16 6 Z"
      fill={color}
      opacity="0.85"
    />
    {/* notch */}
    <path d="M13 15 L16 13 L19 15" stroke="var(--panel-bg)" strokeWidth="1.2" fill="none" />
  </svg>
);

const BardIcon = ({ color }: { color: string }) => (
  // Lute body + neck + strings
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* body */}
    <ellipse cx="16" cy="20" rx="8" ry="9" fill={color} opacity="0.8" />
    {/* sound hole */}
    <circle cx="16" cy="21" r="2.5" fill="var(--panel-bg)" opacity="0.6" />
    {/* neck */}
    <rect x="14.5" y="6" width="3" height="13" rx="1.2" fill={color} />
    {/* tuning head */}
    <rect x="13" y="3" width="6" height="4" rx="1" fill={color} />
    {/* strings */}
    <line x1="14" y1="8" x2="12" y2="26" stroke="var(--panel-bg)" strokeWidth="0.8" opacity="0.7" />
    <line x1="16" y1="8" x2="16" y2="27" stroke="var(--panel-bg)" strokeWidth="0.8" opacity="0.7" />
    <line x1="18" y1="8" x2="20" y2="26" stroke="var(--panel-bg)" strokeWidth="0.8" opacity="0.7" />
  </svg>
);

const ClericIcon = ({ color }: { color: string }) => (
  // Radiant sunburst cross
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* rays */}
    {[0, 45, 90, 135].map(deg => {
      const rad = (deg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return (
        <g key={deg}>
          <line
            x1={16 + cos * 5}
            y1={16 + sin * 5}
            x2={16 + cos * 13}
            y2={16 + sin * 13}
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
          <line
            x1={16 - cos * 5}
            y1={16 - sin * 5}
            x2={16 - cos * 13}
            y2={16 - sin * 13}
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.55"
          />
        </g>
      );
    })}
    {/* cross */}
    <rect x="13.5" y="5" width="5" height="22" rx="2" fill={color} />
    <rect x="5" y="12" width="22" height="5" rx="2" fill={color} />
    {/* center gem */}
    <circle cx="16" cy="14.5" r="3" fill="var(--panel-bg)" stroke={color} strokeWidth="1.2" />
  </svg>
);

const DruidIcon = ({ color }: { color: string }) => (
  // Oak leaf with vein detail
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* leaf body */}
    <path
      d="M16 3 C9 7 5 14 8 21 C10 25 13 27 16 29 C19 27 22 25 24 21 C27 14 23 7 16 3 Z"
      fill={color}
      opacity="0.85"
    />
    {/* stem */}
    <line x1="16" y1="29" x2="16" y2="33" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* center vein */}
    <line x1="16" y1="5" x2="16" y2="28" stroke="var(--panel-bg)" strokeWidth="1.2" opacity="0.6" />
    {/* side veins */}
    <line
      x1="16"
      y1="12"
      x2="10"
      y2="18"
      stroke="var(--panel-bg)"
      strokeWidth="0.9"
      opacity="0.5"
    />
    <line
      x1="16"
      y1="12"
      x2="22"
      y2="18"
      stroke="var(--panel-bg)"
      strokeWidth="0.9"
      opacity="0.5"
    />
    <line
      x1="16"
      y1="18"
      x2="11"
      y2="23"
      stroke="var(--panel-bg)"
      strokeWidth="0.9"
      opacity="0.5"
    />
    <line
      x1="16"
      y1="18"
      x2="21"
      y2="23"
      stroke="var(--panel-bg)"
      strokeWidth="0.9"
      opacity="0.5"
    />
  </svg>
);

const FighterIcon = ({ color }: { color: string }) => (
  // Sword overlaid on heater shield
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* shield */}
    <path
      d="M7 6 H21 V19 C21 24 14 29 14 29 C14 29 7 24 7 19 Z"
      fill={color}
      opacity="0.35"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* sword blade */}
    <line x1="21" y1="4" x2="12" y2="26" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    {/* crossguard */}
    <line x1="18" y1="10" x2="25" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    {/* pommel */}
    <circle cx="12" cy="27" r="1.8" fill={color} />
  </svg>
);

const MonkIcon = ({ color }: { color: string }) => (
  // Open hand radiating ki energy
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* palm */}
    <ellipse cx="16" cy="20" rx="6" ry="7" fill={color} opacity="0.75" />
    {/* fingers */}
    <rect x="10.5" y="10" width="2.5" height="11" rx="1.2" fill={color} />
    <rect x="14" y="8" width="2.5" height="13" rx="1.2" fill={color} />
    <rect x="17.5" y="9" width="2.5" height="12" rx="1.2" fill={color} />
    <rect x="21" y="11" width="2.5" height="10" rx="1.2" fill={color} />
    {/* ki sparks */}
    <circle cx="16" cy="4" r="1.5" fill={color} opacity="0.7" />
    <circle cx="10" cy="6" r="1" fill={color} opacity="0.5" />
    <circle cx="22" cy="6" r="1" fill={color} opacity="0.5" />
  </svg>
);

const PaladinIcon = ({ color }: { color: string }) => (
  // Kite shield with holy cross
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* shield */}
    <path
      d="M5 4 H27 V20 C27 26 16 31 16 31 C16 31 5 26 5 20 Z"
      fill={color}
      opacity="0.8"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* cross cutout */}
    <rect x="13.5" y="8" width="5" height="18" rx="1" fill="var(--panel-bg)" opacity="0.5" />
    <rect x="8" y="13" width="16" height="5" rx="1" fill="var(--panel-bg)" opacity="0.5" />
  </svg>
);

const RangerIcon = ({ color }: { color: string }) => (
  // Bow with arrow nocked
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* bow limbs */}
    <path
      d="M10 4 C6 10 6 22 10 28"
      stroke={color}
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
    {/* bowstring */}
    <line
      x1="10"
      y1="4"
      x2="10"
      y2="28"
      stroke={color}
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.6"
    />
    {/* arrow shaft */}
    <line x1="10" y1="16" x2="28" y2="16" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    {/* arrowhead */}
    <polygon points="28,16 24,13 24,19" fill={color} />
    {/* fletching */}
    <path d="M10 16 L13 13 M10 16 L13 19" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const RogueIcon = ({ color }: { color: string }) => (
  // Stiletto dagger, angled
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* blade */}
    <path d="M8 26 L22 6 L24 8 L10 28 Z" fill={color} opacity="0.85" />
    {/* edge highlight */}
    <line x1="22" y1="6" x2="10" y2="28" stroke="var(--panel-bg)" strokeWidth="0.8" opacity="0.4" />
    {/* crossguard */}
    <line x1="18" y1="13" x2="26" y2="8" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    {/* handle */}
    <rect x="6" y="23" width="6" height="4" rx="1.5" transform="rotate(-50 9 25)" fill={color} />
  </svg>
);

const SorcererIcon = ({ color }: { color: string }) => (
  // Arcane flame / wild magic burst
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* outer glow petals */}
    {[0, 60, 120, 180, 240, 300].map(deg => {
      const rad = (deg * Math.PI) / 180;
      return (
        <ellipse
          key={deg}
          cx={16 + Math.cos(rad) * 9}
          cy={16 + Math.sin(rad) * 9}
          rx="3"
          ry="5"
          transform={`rotate(${deg} ${16 + Math.cos(rad) * 9} ${16 + Math.sin(rad) * 9})`}
          fill={color}
          opacity="0.4"
        />
      );
    })}
    {/* inner flame */}
    <path
      d="M16 6 C13 11 10 13 11 18 C12 22 14 24 16 26 C18 24 20 22 21 18 C22 13 19 11 16 6 Z"
      fill={color}
      opacity="0.9"
    />
    {/* core spark */}
    <circle cx="16" cy="18" r="3" fill="var(--panel-bg)" opacity="0.5" />
  </svg>
);

const WarlockIcon = ({ color }: { color: string }) => (
  // Eldritch eye with slit pupil
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* eye outline */}
    <path
      d="M4 16 C8 8 24 8 28 16 C24 24 8 24 4 16 Z"
      fill={color}
      opacity="0.25"
      stroke={color}
      strokeWidth="1.5"
    />
    {/* iris */}
    <circle cx="16" cy="16" r="5.5" fill={color} opacity="0.7" />
    {/* slit pupil */}
    <ellipse cx="16" cy="16" rx="1.5" ry="5" fill="var(--panel-bg)" opacity="0.85" />
    {/* arcane tendrils */}
    <path
      d="M4 16 C6 12 10 10 12 11"
      stroke={color}
      strokeWidth="1"
      opacity="0.5"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M28 16 C26 12 22 10 20 11"
      stroke={color}
      strokeWidth="1"
      opacity="0.5"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M4 16 C6 20 10 22 12 21"
      stroke={color}
      strokeWidth="1"
      opacity="0.5"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d="M28 16 C26 20 22 22 20 21"
      stroke={color}
      strokeWidth="1"
      opacity="0.5"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

const WizardIcon = ({ color }: { color: string }) => (
  // Arcane staff with 8-pointed star
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* staff */}
    <line x1="16" y1="12" x2="16" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    {/* 8-point star */}
    {[0, 45, 90, 135].map(deg => {
      const rad = (deg * Math.PI) / 180;
      return (
        <line
          key={deg}
          x1={16 + Math.cos(rad) * 8}
          y1={16 + Math.sin(rad) * 8 - 12}
          x2={16 - Math.cos(rad) * 8}
          y2={16 - Math.sin(rad) * 8 - 12}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
      );
    })}
    {/* center orb */}
    <circle cx="16" cy="4" r="4" fill={color} opacity="0.85" />
    <circle cx="16" cy="4" r="2" fill="var(--panel-bg)" opacity="0.5" />
  </svg>
);

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ color: string }>> = {
  barbarian: BarbarianIcon,
  bard: BardIcon,
  cleric: ClericIcon,
  druid: DruidIcon,
  fighter: FighterIcon,
  monk: MonkIcon,
  paladin: PaladinIcon,
  ranger: RangerIcon,
  rogue: RogueIcon,
  sorcerer: SorcererIcon,
  warlock: WarlockIcon,
  wizard: WizardIcon,
};

// ─── Public component ─────────────────────────────────────────────────────────

export function ClassIcon({ className, size = 32, color = 'currentColor' }: ClassIconProps) {
  const key = (className || '').toLowerCase();
  const IconComponent = ICON_MAP[key];

  if (!IconComponent) {
    // Fallback: simple diamond
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon points="16,3 29,16 16,29 3,16" fill={color} opacity="0.8" />
      </svg>
    );
  }

  return (
    <span style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <IconComponent color={color} />
    </span>
  );
}

export default ClassIcon;
