import { useState } from 'react';
import {
  BookOpen, Dumbbell, Gamepad2, Headphones, Home, Music2, Package, Shirt, Watch,
} from 'lucide-react';

// One icon + warm hue (0 to 36 on the colour wheel, so dark mode never turns olive) per category. Products have no photos, so this tile is their picture.
const BY_NAME = {
  'Electronics': { Icon: Headphones, hue: 30 },
  'Musical Instruments': { Icon: Music2, hue: 12 },
  'Fitness': { Icon: Dumbbell, hue: 34 },
  'Gaming': { Icon: Gamepad2, hue: 2 },
  'Wearables': { Icon: Watch, hue: 22 },
  'Home & Kitchen': { Icon: Home, hue: 18 },
  'Books & Stationery': { Icon: BookOpen, hue: 36 },
  'Fashion': { Icon: Shirt, hue: 6 },
};

export function categoryStyle(name) {
  return BY_NAME[name] || { Icon: Package, hue: 30 };
}

/** The product picture: its photo when it has one, otherwise a coloured tile with the category icon. */
export function ProductArt({ category, size = 'md', src, name = '' }) {
  const { Icon, hue } = categoryStyle(category);
  const [hasFailed, setHasFailed] = useState(false);
  const showPhoto = Boolean(src) && !hasFailed;
  return (
    <div className={`art art-${size} ${showPhoto ? 'art-photo' : ''}`} style={{ '--hue': hue }}>
      {showPhoto
        ? <img src={src} alt={name} width="640" height="640" loading="lazy" decoding="async" onError={() => setHasFailed(true)} />
        : <Icon strokeWidth={1.5} aria-hidden="true" />}
    </div>
  );
}
