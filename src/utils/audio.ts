/**
 * Audio — synthesized sound effects and generative background music via Web Audio.
 *
 * No asset files: every sound is built from oscillators at play time. Everything
 * is a no-op when AudioContext is unavailable (jsdom, SSR, old browsers).
 *
 * ponytail: procedural audio only. Swap `playMusic` for an HTMLAudioElement loop
 * and `playSfx` for decoded AudioBuffers when real assets land.
 */
import logger from './logger';

export type SfxName =
  | 'click'
  | 'step'
  | 'hit'
  | 'miss'
  | 'success'
  | 'error'
  | 'warning'
  | 'encounter'
  | 'discovery'
  | 'levelup';

export type MusicTrack = 'title' | 'overworld' | 'combat' | 'gameover';

interface Graph {
  ctx: AudioContext;
  music: GainNode;
  sfx: GainNode;
}

let graph: Graph | null = null;
let musicVolume = 0.5;
let sfxVolume = 0.7;
let currentTrack: MusicTrack | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;

const hasAudio = () => typeof window !== 'undefined' && typeof AudioContext !== 'undefined';

function getGraph(): Graph | null {
  if (!hasAudio()) return null;
  if (graph) return graph;
  const ctx = new AudioContext();
  const music = ctx.createGain();
  const sfx = ctx.createGain();
  music.gain.value = musicVolume;
  sfx.gain.value = sfxVolume;
  music.connect(ctx.destination);
  sfx.connect(ctx.destination);
  graph = { ctx, music, sfx };
  return graph;
}

/** Call from a user gesture: browsers keep the context suspended until then. */
export function unlockAudio(): void {
  const g = getGraph();
  if (g && g.ctx.state === 'suspended') {
    g.ctx.resume().catch(err => logger.general.warn('Audio resume failed', { err }));
  }
  // Music requested before unlock starts once the context runs.
  if (currentTrack && !musicTimer) startScheduler(currentTrack);
}

export function setVolumes(music: number, sfx: number): void {
  musicVolume = clamp01(music);
  sfxVolume = clamp01(sfx);
  if (graph) {
    graph.music.gain.value = musicVolume;
    graph.sfx.gain.value = sfxVolume;
  }
}

export const clamp01 = (n: number): number =>
  Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

/** One enveloped oscillator tone. */
function tone(
  g: Graph,
  dest: GainNode,
  opts: {
    type: OscillatorType;
    from: number;
    to?: number;
    start?: number;
    dur: number;
    gain?: number;
  }
): void {
  const { ctx } = g;
  const t0 = ctx.currentTime + (opts.start ?? 0);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = opts.type;
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(opts.gain ?? 0.3, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
  osc.connect(env).connect(dest);
  osc.start(t0);
  osc.stop(t0 + opts.dur + 0.02);
}

/** Short filtered noise burst (impacts, footsteps). */
function noise(g: Graph, dest: GainNode, dur: number, cutoff: number, gain = 0.4): void {
  const { ctx } = g;
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const env = ctx.createGain();
  const t0 = ctx.currentTime;
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(env).connect(dest);
  src.start(t0);
}

const SFX: Record<SfxName, (g: Graph, d: GainNode) => void> = {
  click: (g, d) => tone(g, d, { type: 'square', from: 900, to: 600, dur: 0.05, gain: 0.15 }),
  step: (g, d) => noise(g, d, 0.08, 500, 0.25),
  hit: (g, d) => {
    noise(g, d, 0.15, 1200, 0.5);
    tone(g, d, { type: 'sawtooth', from: 180, to: 60, dur: 0.18, gain: 0.35 });
  },
  miss: (g, d) => tone(g, d, { type: 'sine', from: 700, to: 250, dur: 0.2, gain: 0.2 }),
  success: (g, d) => {
    tone(g, d, { type: 'triangle', from: 523, dur: 0.12, gain: 0.25 });
    tone(g, d, { type: 'triangle', from: 784, dur: 0.2, start: 0.1, gain: 0.25 });
  },
  error: (g, d) => tone(g, d, { type: 'square', from: 200, to: 120, dur: 0.25, gain: 0.2 }),
  warning: (g, d) => tone(g, d, { type: 'triangle', from: 330, to: 300, dur: 0.2, gain: 0.2 }),
  encounter: (g, d) => {
    tone(g, d, { type: 'sawtooth', from: 110, dur: 0.35, gain: 0.3 });
    tone(g, d, { type: 'sawtooth', from: 116, dur: 0.5, start: 0.2, gain: 0.3 });
  },
  discovery: (g, d) => {
    [523, 659, 784, 1046].forEach((f, i) =>
      tone(g, d, { type: 'sine', from: f, dur: 0.25, start: i * 0.08, gain: 0.2 })
    );
  },
  levelup: (g, d) => {
    [392, 523, 659, 784, 1046].forEach((f, i) =>
      tone(g, d, { type: 'triangle', from: f, dur: 0.4, start: i * 0.12, gain: 0.25 })
    );
  },
};

export function playSfx(name: SfxName): void {
  const g = getGraph();
  if (!g || g.ctx.state !== 'running' || sfxVolume === 0) return;
  try {
    SFX[name](g, g.sfx);
  } catch (err) {
    logger.general.warn('playSfx failed', { name, err });
  }
}

// ---------------------------------------------------------------------------
// Generative music: a slow arpeggio over a scale, one voice per track.
// ---------------------------------------------------------------------------

interface TrackDef {
  root: number; // Hz
  scale: number[]; // semitone offsets
  bpm: number;
  type: OscillatorType;
  noteDur: number;
  gain: number;
}

const TRACKS: Record<MusicTrack, TrackDef> = {
  title: {
    root: 220,
    scale: [0, 3, 7, 10, 12, 15],
    bpm: 60,
    type: 'sine',
    noteDur: 1.6,
    gain: 0.18,
  },
  overworld: {
    root: 196,
    scale: [0, 2, 4, 7, 9, 12],
    bpm: 84,
    type: 'triangle',
    noteDur: 1.1,
    gain: 0.16,
  },
  combat: {
    root: 110,
    scale: [0, 1, 5, 6, 7, 12],
    bpm: 150,
    type: 'sawtooth',
    noteDur: 0.28,
    gain: 0.12,
  },
  gameover: { root: 147, scale: [0, 3, 5, 8, 12], bpm: 40, type: 'sine', noteDur: 2.6, gain: 0.18 },
};

function stopScheduler(): void {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

function startScheduler(track: MusicTrack): void {
  const g = getGraph();
  if (!g || g.ctx.state !== 'running') return;
  stopScheduler();
  const def = TRACKS[track];
  let i = 0;
  const playNote = () => {
    if (musicVolume === 0) return;
    const step = def.scale[(i * 5 + Math.floor(i / def.scale.length)) % def.scale.length];
    const octave = i % 4 === 3 ? 2 : 1;
    i++;
    tone(g, g.music, {
      type: def.type,
      from: def.root * octave * Math.pow(2, step / 12),
      dur: def.noteDur,
      gain: def.gain,
    });
  };
  playNote();
  musicTimer = setInterval(playNote, 60000 / def.bpm);
}

export function playMusic(track: MusicTrack | null): void {
  if (track === currentTrack && (musicTimer || !track)) return;
  currentTrack = track;
  if (!track) {
    stopScheduler();
    return;
  }
  startScheduler(track);
}

/** Test hook. */
export function _resetAudioForTests(): void {
  stopScheduler();
  graph = null;
  currentTrack = null;
}
