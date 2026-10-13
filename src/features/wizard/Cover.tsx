import { MOOD_HUE, type MoodId } from "./catalog";

// The cover is generated from the mood (hue) and the energy (speed). Motion is disabled by the reduced-motion rule in CSS.
export function SongCover({ mood, energy, label }: { mood: MoodId; energy: number; label: string }) {
  const hue = MOOD_HUE[mood];
  const seconds = Math.round(16 - energy * 1.1);
  const background = `linear-gradient(120deg, hsl(${hue} 85% 55%), hsl(${(hue + 60) % 360} 80% 45%), hsl(${(hue + 180) % 360} 70% 25%))`;

  return (
    <div
      role="img"
      aria-label={label}
      className="cover-drift aspect-square w-full max-w-56 rounded-3xl shadow-2xl shadow-black/50"
      style={{ backgroundImage: background, backgroundSize: "200% 200%", animationDuration: `${seconds}s` }}
    />
  );
}
