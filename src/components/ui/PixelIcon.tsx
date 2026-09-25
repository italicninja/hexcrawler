import { useMemo } from 'react';
import { pixelIconImage } from '../../utils/pixelIcons';

interface PixelIconProps {
  /** Sprite name from utils/pixelIcons (e.g. 'action', 'coins', 'star'). */
  name: string;
  /** CSS pixels per art pixel. */
  scale?: number;
  /** Accessible label; omit for decorative icons next to text. */
  label?: string;
}

/** A pixel-art sprite in HTML, matching the canvas icons. */
function PixelIcon({ name, scale = 2, label }: PixelIconProps) {
  const img = useMemo(() => pixelIconImage(name), [name]);
  if (!img) return null;
  return (
    <img
      src={img.url}
      width={img.w * scale}
      height={img.h * scale}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      style={{ imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

export default PixelIcon;
