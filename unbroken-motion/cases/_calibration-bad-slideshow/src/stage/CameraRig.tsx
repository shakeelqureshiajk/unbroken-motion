import React from 'react';
import type { EvaluatedCamera, Resolution } from '../lib/types.ts';

export interface CameraRigProps {
  camera: EvaluatedCamera;
  resolution: Resolution;
  stageScale: number;
  enableDraftBlur?: boolean;
  children: React.ReactNode;
}

/**
 * Single continuous 2.5D virtual camera transforming the stage coordinate plane
 * around viewport center and applying directional blur during fast moves in drafts.
 */
export const CameraRig: React.FC<CameraRigProps> = ({
  camera,
  resolution,
  stageScale,
  enableDraftBlur = true,
  children,
}) => {
  const totalScale = camera.zoom * stageScale;
  const cx = resolution.width / 2;
  const cy = resolution.height / 2;

  const blurPx =
    enableDraftBlur && camera.blurEnabled
      ? Math.min(8, camera.blurStrength * 0.32)
      : 0;

  return (
    <div
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        width: 0,
        height: 0,
        transformOrigin: '0 0',
        transform: `scale(${totalScale}) rotate(${-camera.roll}deg) translate(${-camera.x}px, ${-camera.y}px)`,
        filter: blurPx > 0.25 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
