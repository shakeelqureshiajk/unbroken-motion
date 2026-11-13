import React, { createContext, useContext } from 'react';
import { useCurrentFrame } from 'remotion';

/**
 * Provides sub-frame shutter offset (in frames, e.g., -0.25 .. +0.25)
 * during temporal supersampling renders while keeping Remotion seek deterministic.
 */
export const ShutterContext = createContext<number>(0);

export const ShutterProvider: React.FC<{
  shutterOffset?: number;
  children: React.ReactNode;
}> = ({ shutterOffset = 0, children }) => {
  return React.createElement(
    ShutterContext.Provider,
    { value: shutterOffset },
    children
  );
};

export function useShutterOffset(): number {
  return useContext(ShutterContext);
}

/**
 * Always use this instead of raw useCurrentFrame() in compositions so
 * sub-frame motion blur sampling evaluates exact fractional frame times.
 */
export function useContinuousFrame(): number {
  const frame = useCurrentFrame();
  const offset = useShutterOffset();
  return frame + offset;
}
