import { MOOD_HUE, type MoodId } from "./catalog";

// The cover is generated from the mood (hue) and the energy (speed). Motion is disabled by the reduced-motion rule in CSS.
// An empty label marks the cover as decorative, for lists where the title is already announced.
export function SongCover({
  mood,
  energy,
  label,
  size = "lg",
}: {
  mood: string | null;
  energy: number | null;
  label: string;
  size?: "sm" | "lg";
}) {
  const hue = mood && Object.prototype.hasOwnProperty.call(MOOD_HUE, mood) ? MOOD_HUE[mood as MoodId] : 280;
  const seconds = Math.round(16 - (energy ?? 5) * 1.1);
  const background = `linear-gradient(120deg, hsl(${hue} 85% 55%), hsl(${(hue + 60) % 360} 80% 45%), hsl(${(hue + 180) % 360} 70% 25%))`;
  const sizeClass =
    size === "lg" ? "aspect-square w-full max-w-56 rounded-3xl shadow-2xl shadow-black/50" : "aspect-square w-16 shrink-0 rounded-2xl";

  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      className={`cover-drift ${sizeClass}`}
      style={{ backgroundImage: background, backgroundSize: "200% 200%", animationDuration: `${seconds}s` }}
    />
  );
}
