// Haptic feedback utility for native apps (Capacitor)
// Falls back gracefully on web

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

interface HapticImpact {
  impact: (options: { style: string }) => Promise<void>;
}

interface HapticNotification {
  notification: (options: { type: string }) => Promise<void>;
}

// Check if running in Capacitor native environment
const isNative = (): boolean => {
  return typeof window !== 'undefined' && 
    'Capacitor' in window && 
    (window as any).Capacitor?.isNativePlatform?.();
};

// Dynamic import of Capacitor haptics
let hapticModule: (HapticImpact & HapticNotification) | null = null;

const loadHaptics = async () => {
  if (hapticModule) return hapticModule;
  
  try {
    const { Haptics } = await import('@capacitor/haptics');
    hapticModule = Haptics;
    return hapticModule;
  } catch {
    return null;
  }
};

export async function triggerHaptic(style: HapticStyle = 'medium'): Promise<void> {
  // Use Web Vibration API as fallback
  if (!isNative()) {
    if ('vibrate' in navigator) {
      const durations: Record<HapticStyle, number> = {
        light: 10,
        medium: 20,
        heavy: 30,
        success: 15,
        warning: 25,
        error: 35,
      };
      navigator.vibrate(durations[style]);
    }
    return;
  }

  try {
    const haptics = await loadHaptics();
    if (!haptics) return;

    if (['success', 'warning', 'error'].includes(style)) {
      await haptics.notification({
        type: style.toUpperCase(),
      });
    } else {
      await haptics.impact({
        style: style.toUpperCase(),
      });
    }
  } catch (error) {
    // Silently fail - haptics are optional
    console.debug('Haptic feedback not available:', error);
  }
}

// Selection haptic for list item taps
export async function selectionHaptic(): Promise<void> {
  return triggerHaptic('light');
}

// Success haptic for completed actions
export async function successHaptic(): Promise<void> {
  return triggerHaptic('success');
}

// Warning haptic for destructive action confirmations
export async function warningHaptic(): Promise<void> {
  return triggerHaptic('warning');
}
