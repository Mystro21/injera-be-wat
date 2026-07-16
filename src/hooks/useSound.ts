import { useCallback } from 'react';
export function useSound(enabled: boolean) {
  return useCallback((kind: 'draw' | 'capture' | 'win') => {
    if (!enabled) return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const context = new AudioCtx(); const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.frequency.value = kind === 'draw' ? 260 : kind === 'capture' ? 440 : 620;
    gain.gain.setValueAtTime(0.05, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.13);
  }, [enabled]);
}
