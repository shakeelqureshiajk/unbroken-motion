import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CURVE_SPECS, evaluateCurve } from '../lib/easing.ts';
import { useContinuousFrame } from '../lib/time.ts';
import type { BrandTokens, CurvePreset } from '../lib/types.ts';
import { BrandProvider } from '../stage/BrandContext.tsx';

const PRESETS: CurvePreset[] = [
  'snappy',
  'soft',
  'heavy',
  'overshoot',
  'whipQuart',
  'linear',
];

export const Gallery: React.FC<{ brand: BrandTokens }> = ({ brand }) => {
  const frame = useContinuousFrame();
  const fps = 30;
  const cycleSec = 2.0;
  const u = ((frame / fps) % cycleSec) / 1.2;
  const uClamped = Math.min(1, Math.max(0, u));

  return (
    <BrandProvider brand={brand}>
      <AbsoluteFill
        style={{
          backgroundColor: brand.colors.background,
          color: brand.colors.textPrimary,
          fontFamily: brand.typography.bodyFont,
          padding: 64,
          display: 'flex',
          flexDirection: 'column',
          gap: 36,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div
            style={{
              fontFamily: brand.typography.headingFont,
              fontWeight: brand.typography.headingWeight,
              fontSize: 44,
            }}
          >
            Unbroken Motion — Move & Curve Gallery
          </div>
          <div
            style={{
              fontFamily: brand.typography.monoFont,
              fontSize: 22,
              color: brand.colors.primary,
            }}
          >
            Brand: {brand.name} ({brand.id})
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 28,
            flex: 1,
          }}
        >
          {PRESETS.map((preset) => {
            const spec = CURVE_SPECS[preset];
            const progress = evaluateCurve(preset, uClamped, 1.0);
            const xOffset = progress * 520;
            return (
              <div
                key={preset}
                style={{
                  backgroundColor: brand.colors.surface,
                  border: `${brand.geometry.borderWidth}px solid ${brand.colors.border}`,
                  borderRadius: brand.geometry.radiusMd,
                  padding: 26,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontFamily: brand.typography.monoFont,
                      fontWeight: 700,
                      fontSize: 24,
                      color: brand.colors.primary,
                    }}
                  >
                    {preset}
                  </span>
                  <span
                    style={{
                      fontFamily: brand.typography.monoFont,
                      fontSize: 18,
                      color: brand.colors.textMuted,
                    }}
                  >
                    peak {spec.peakVelocityPerUnit}/s · settle {spec.effectiveSettleSec}s
                  </span>
                </div>

                <div style={{ fontSize: 18, color: brand.colors.textMuted }}>
                  {spec.description}
                </div>

                <div
                  style={{
                    height: 48,
                    borderRadius: brand.geometry.radiusSm,
                    backgroundColor: brand.colors.background,
                    border: `1px solid ${brand.colors.border}`,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 99,
                      backgroundColor: brand.colors.accent,
                      transform: `translateX(${xOffset.toFixed(1)}px)`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </BrandProvider>
  );
};
