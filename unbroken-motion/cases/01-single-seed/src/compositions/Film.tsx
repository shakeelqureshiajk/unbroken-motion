import React from 'react';
import { ActorRenderer } from '../lib/ui-kit.tsx';
import { useContinuousFrame } from '../lib/time.ts';
import type { BeatSheet, BrandTokens } from '../lib/types.ts';
import { evaluateFilmFrame } from '../scene.ts';
import { Actor } from '../stage/Actor.tsx';
import { BrandProvider } from '../stage/BrandContext.tsx';
import { CameraRig } from '../stage/CameraRig.tsx';
import { Stage } from '../stage/Stage.tsx';

export interface FilmProps {
  beats: BeatSheet;
  brand: BrandTokens;
  enableDraftBlur?: boolean;
}

export const Film: React.FC<FilmProps> = ({
  beats,
  brand,
  enableDraftBlur = true,
}) => {
  const continuousFrame = useContinuousFrame();
  const scene = evaluateFilmFrame(beats, brand, continuousFrame);
  const sortedActors = [...scene.actors].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <BrandProvider brand={brand}>
      <Stage
        resolution={scene.resolution}
        stageSize={scene.stageSize}
        stageScale={scene.stageScale}
      >
        <CameraRig
          camera={scene.camera}
          resolution={scene.resolution}
          stageScale={scene.stageScale}
          enableDraftBlur={enableDraftBlur}
        >
          {sortedActors.map((actor) => (
            <Actor
              key={actor.id}
              actor={actor}
              enableDraftBlur={enableDraftBlur}
            >
              <ActorRenderer actor={actor} />
            </Actor>
          ))}
        </CameraRig>
      </Stage>
    </BrandProvider>
  );
};
