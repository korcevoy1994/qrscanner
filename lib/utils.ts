import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Haptic feedback utility that works on both iOS and Android
 * iOS: Uses AudioContext trick to trigger haptic
 * Android: Uses Vibration API
 */
export function hapticFeedback(type: 'success' | 'error' | 'warning' = 'success') {
  // Try Vibration API first (Android)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (type) {
      case 'success':
        navigator.vibrate(50);
        break;
      case 'error':
        navigator.vibrate([50, 50, 50]); // Double vibration
        break;
      case 'warning':
        navigator.vibrate(100);
        break;
    }
    return;
  }

  // Fallback: Try to trigger iOS haptic via user interaction context
  // This works when called from a user gesture handler
  if (typeof window !== 'undefined' && 'ontouchstart' in window) {
    try {
      // Create a tiny audio context interaction to trigger haptic on iOS
      const AudioContext = window.AudioContext || (window as Window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        oscillator.frequency.value = 0;
        oscillator.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.001);
        setTimeout(() => ctx.close(), 100);
      }
    } catch {
      // Silently fail - haptic not available
    }
  }
}
