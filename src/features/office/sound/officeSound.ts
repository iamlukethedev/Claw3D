"use client";

export type OfficeSoundCue =
  | "task-start"
  | "task-complete"
  | "alarm"
  | "doorbell"
  | "chime";

type CueTone = {
  frequency: number;
  durationMs: number;
  delayMs?: number;
  type?: OscillatorType;
  gain?: number;
};

const CUE_TONES: Record<OfficeSoundCue, CueTone[]> = {
  "task-start": [
    { frequency: 660, durationMs: 70, type: "triangle", gain: 0.035 },
    { frequency: 880, durationMs: 90, delayMs: 80, type: "triangle", gain: 0.032 },
  ],
  "task-complete": [
    { frequency: 784, durationMs: 80, type: "sine", gain: 0.032 },
    { frequency: 1046, durationMs: 120, delayMs: 90, type: "sine", gain: 0.03 },
  ],
  alarm: [
    { frequency: 220, durationMs: 140, type: "sawtooth", gain: 0.035 },
    { frequency: 196, durationMs: 140, delayMs: 160, type: "sawtooth", gain: 0.035 },
  ],
  doorbell: [
    { frequency: 523, durationMs: 130, type: "sine", gain: 0.035 },
    { frequency: 659, durationMs: 170, delayMs: 145, type: "sine", gain: 0.032 },
  ],
  chime: [
    { frequency: 880, durationMs: 100, type: "triangle", gain: 0.026 },
    { frequency: 1175, durationMs: 140, delayMs: 110, type: "triangle", gain: 0.024 },
  ],
};

export const resolveOfficeSoundCueForExternalEvent = (params: {
  effect: string | null | undefined;
  soundCueId?: string | null;
}): OfficeSoundCue | null => {
  const cue = params.soundCueId?.trim() ?? "";
  if (cue === "alarm" || cue === "doorbell" || cue === "chime") return cue;
  if (params.effect === "alarm") return "alarm";
  if (params.effect === "doorbell") return "doorbell";
  if (params.effect === "confetti") return "chime";
  return null;
};

export const resolveOfficeSoundCueForRunTransition = (params: {
  wasRunning: boolean;
  isRunning: boolean;
  isError: boolean;
}): OfficeSoundCue | null => {
  if (params.isError) return "alarm";
  if (!params.wasRunning && params.isRunning) return "task-start";
  if (params.wasRunning && !params.isRunning) return "task-complete";
  return null;
};

export const playOfficeSoundCue = async (params: {
  cue: OfficeSoundCue;
  volume: number;
  audioContextRef?: React.MutableRefObject<AudioContext | null>;
}) => {
  if (typeof window === "undefined") return false;
  const AudioContextCtor =
    window.AudioContext ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((window as any).webkitAudioContext as typeof AudioContext | undefined);
  if (!AudioContextCtor) return false;
  if (!params.audioContextRef) return false;
  if (!params.audioContextRef.current) {
    params.audioContextRef.current = new AudioContextCtor();
  }
  const audioContext = params.audioContextRef.current;
  if (audioContext.state === "suspended") {
    try {
      await audioContext.resume();
    } catch {
      return false;
    }
  }
  const volume = Math.max(0, Math.min(1, params.volume));
  const tones = CUE_TONES[params.cue] ?? [];
  const now = audioContext.currentTime;
  for (const tone of tones) {
    const start = now + (tone.delayMs ?? 0) / 1000;
    const duration = tone.durationMs / 1000;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime((tone.gain ?? 0.03) * volume, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
  return true;
};
