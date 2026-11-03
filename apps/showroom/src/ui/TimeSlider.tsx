// Always-visible time-of-day control: sun at the top, moon at the bottom, morning to night between them.
import { formatTime, t, TIME_MAX, TIME_MIN } from '@bair/project-data';
import { useAppStore } from '../store/useAppStore';
import { IconMoon, IconPause, IconPlay, IconSun } from './icons';

const TICKS = [6, 9, 12, 15, 18, 21].map((h) => h * 60);
const percent = (m: number) => ((m - TIME_MIN) / (TIME_MAX - TIME_MIN)) * 100;

export function TimeSlider() {
  const time = useAppStore((s) => s.time);
  const setTime = useAppStore((s) => s.setTime);
  const playing = useAppStore((s) => s.playing);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const label = formatTime(time);
  return (
    <aside className="time-slider glass pointer-events-auto" aria-label={t.time.title}>
      <IconSun />
      <div className="time-slider__rail">
        <input
          type="range"
          min={TIME_MIN}
          max={TIME_MAX}
          step={5}
          value={time}
          aria-label={t.time.title}
          aria-valuetext={label}
          onChange={(e) => setTime(Number(e.target.value))}
        />
        {TICKS.map((m) => (
          <span key={m} className="time-slider__tick" style={{ top: `${percent(m)}%` }}>
            {formatTime(m)}
          </span>
        ))}
        <output className="time-slider__now" style={{ top: `${percent(time)}%` }}>
          {label}
        </output>
      </div>
      <IconMoon />
      <button
        type="button"
        className="time-slider__play"
        aria-label={playing ? t.time.pause : t.time.play}
        aria-pressed={playing}
        onClick={() => setPlaying(!playing)}
      >
        {playing ? <IconPause /> : <IconPlay />}
      </button>
    </aside>
  );
}
