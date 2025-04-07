import { useRef } from 'react';

export function useMutableValue<T>(initialValue: T) {
  const ref = useRef<T>(initialValue);
  
  return {
    get: () => ref.current,
    set: (value: T) => {
      ref.current = value;
    },
    // For cases where you need the ref itself
    ref
  };
} 