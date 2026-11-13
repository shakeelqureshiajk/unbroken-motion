import React from 'react';
import { AbsoluteFill } from 'remotion';
import { useBrand } from './BrandContext.tsx';
import type { Resolution } from '../lib/types.ts';

export interface StageProps {
  resolution: Resolution;
  stageSize: Resolution;
  stageScale: number;
  showSubtleGrid?: boolean;
  children: React.ReactNode;
}

/**
 * Center-origin aspect-adaptive stage painting brand background and subtle grid depth.
 */
export const Stage: React.FC<StageProps> = ({
  resolution,
  stageScale,
  showSubtleGrid = true,
  children,
}) => {
  const brand = useBrand();
  const gridStep = Math.round(96 * stageScale);

  return (
    <AbsoluteFill
      style={{
        width: resolution.width,
        height: resolution.height,
        backgroundColor: brand.colors.background,
        overflow: 'hidden',
        position: 'relative',
        fontFamily: brand.typography.bodyFont,
        color: brand.colors.textPrimary,
      }}
    >
      {/* Subtle radial atmosphere */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${brand.colors.surface}55 0%, ${brand.colors.background}00 72%)`,
          pointerEvents: 'none',
        }}
      />
      {showSubtleGrid && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(to right, ${brand.colors.border}28 1px, transparent 1px), linear-gradient(to bottom, ${brand.colors.border}28 1px, transparent 1px)`,
            backgroundSize: `${gridStep}px ${gridStep}px`,
            backgroundPosition: 'center center',
            pointerEvents: 'none',
          }}
        />
      )}
      {children}
    </AbsoluteFill>
  );
};
