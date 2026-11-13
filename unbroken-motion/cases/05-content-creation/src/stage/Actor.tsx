import React from 'react';
import type { EvaluatedActor } from '../lib/types.ts';

export interface ActorProps {
  actor: EvaluatedActor;
  enableDraftBlur?: boolean;
  children: React.ReactNode;
}

/**
 * Tracked world-space element positioned deterministically on the camera's stage plane.
 */
export const Actor: React.FC<ActorProps> = ({
  actor,
  enableDraftBlur = true,
  children,
}) => {
  if (!actor.visible || actor.opacity <= 0.005) {
    return null;
  }

  const { cx, cy, width, height, borderRadius, rotation, scale } = actor.worldBox;
  const blurPx =
    enableDraftBlur && actor.blurEnabled
      ? Math.min(7, actor.blurStrength * 0.28)
      : 0;

  return (
    <div
      data-actor-id={actor.id}
      data-actor-kind={actor.kind}
      style={{
        position: 'absolute',
        left: cx,
        top: cy,
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        borderRadius,
        opacity: actor.opacity,
        zIndex: actor.zIndex,
        transform: `rotate(${rotation}deg) scale(${scale})`,
        transformOrigin: 'center center',
        filter: blurPx > 0.25 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
};
