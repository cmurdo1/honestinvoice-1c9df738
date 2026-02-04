import { useRef, useState, useCallback, useEffect } from 'react';
import { triggerHaptic } from '@/lib/haptics';

interface UseSwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  disabled?: boolean;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  disabled = false,
}: UseSwipeGestureOptions) {
  const [swipeDistance, setSwipeDistance] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const isSwiping = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isSwiping.current = true;
    isHorizontal.current = null;
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping.current || disabled) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Determine direction on first significant move
    if (isHorizontal.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontal.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Only track horizontal swipes
    if (isHorizontal.current === true) {
      e.preventDefault();
      // Apply resistance at edges
      const resistance = Math.abs(diffX) > threshold ? 0.3 : 0.8;
      setSwipeDistance(diffX * resistance);
    }
  }, [disabled, threshold]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    isHorizontal.current = null;

    if (Math.abs(swipeDistance) >= threshold) {
      triggerHaptic('light');
      
      if (swipeDistance < 0 && onSwipeLeft) {
        onSwipeLeft();
      } else if (swipeDistance > 0 && onSwipeRight) {
        onSwipeRight();
      }
    }
    
    setSwipeDistance(0);
  }, [swipeDistance, threshold, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd);

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    elementRef,
    swipeDistance,
    isSwiping: swipeDistance !== 0,
  };
}
