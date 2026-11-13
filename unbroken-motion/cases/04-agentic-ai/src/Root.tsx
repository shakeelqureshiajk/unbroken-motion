import React from 'react';
import { Composition } from 'remotion';
import beatsJson from '../beats.json' with { type: 'json' };
import brandJson from './brand.json' with { type: 'json' };
import {
  DiagnosticSheet,
  type DiagnosticRow,
  type DiagnosticSheetProps,
} from './compositions/DiagnosticSheet.tsx';
import { Film } from './compositions/Film.tsx';
import { Gallery } from './compositions/Gallery.tsx';
import { ShutterProvider } from './lib/time.ts';
import type { BeatSheet, BrandTokens } from './lib/types.ts';

const beats = beatsJson as BeatSheet;
const brand = brandJson as BrandTokens;

const lastBeat = beats.beats[beats.beats.length - 1];
const totalDurationSec = lastBeat ? lastBeat.start + lastBeat.duration : 5;
const defaultFrames = Math.max(1, Math.round(totalDurationSec * beats.fps));

export type RootFilmInputProps = {
  shutterOffset?: number;
  enableDraftBlur?: boolean;
  beatsOverride?: BeatSheet;
  brandOverride?: BrandTokens;
};

const FilmWithShutter: React.FC<RootFilmInputProps> = ({
  shutterOffset = 0,
  enableDraftBlur = true,
  beatsOverride,
  brandOverride,
}) => {
  return (
    <ShutterProvider shutterOffset={shutterOffset}>
      <Film
        beats={beatsOverride ?? beats}
        brand={brandOverride ?? brand}
        enableDraftBlur={enableDraftBlur}
      />
    </ShutterProvider>
  );
};

const DiagnosticSheetWrapper: React.FC<Record<string, unknown>> = (props) => {
  const typed = props as unknown as DiagnosticSheetProps;
  return (
    <DiagnosticSheet
      sheetTitle={typed.sheetTitle ?? 'Diagnostic Sheet'}
      sheetSubtitle={typed.sheetSubtitle ?? ''}
      rows={typed.rows ?? []}
    />
  );
};

const GalleryWrapper: React.FC<Record<string, unknown>> = (props) => {
  const b = (props.brand as BrandTokens | undefined) ?? brand;
  return <Gallery brand={b} />;
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Film"
        component={FilmWithShutter}
        durationInFrames={defaultFrames}
        fps={beats.fps}
        width={beats.resolution.width}
        height={beats.resolution.height}
        defaultProps={{
          shutterOffset: 0,
          enableDraftBlur: true,
        }}
        calculateMetadata={({ props }) => {
          const typed = props as RootFilmInputProps;
          const activeBeats: BeatSheet = typed.beatsOverride ?? beats;
          const endBeat = activeBeats.beats[activeBeats.beats.length - 1];
          const durSec = endBeat ? endBeat.start + endBeat.duration : 5;
          return {
            durationInFrames: Math.max(1, Math.round(durSec * activeBeats.fps)),
            fps: activeBeats.fps,
            width: activeBeats.resolution.width,
            height: activeBeats.resolution.height,
          };
        }}
      />
      <Composition
        id="Gallery"
        component={GalleryWrapper}
        durationInFrames={120}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ brand }}
      />
      <Composition
        id="DiagnosticSheet"
        component={DiagnosticSheetWrapper}
        durationInFrames={1}
        fps={30}
        width={1860}
        height={1200}
        defaultProps={{
          sheetTitle: 'Diagnostic Sheet',
          sheetSubtitle: '',
          rows: [] as DiagnosticRow[],
        }}
        calculateMetadata={({ props }) => {
          const rows = (props.rows as DiagnosticRow[] | undefined) ?? [];
          const rowCount = Math.max(1, rows.length);
          const firstTile = rows[0]?.tiles?.[0];
          const tileRatio = firstTile
            ? firstTile.sourceHeight / Math.max(1, firstTile.sourceWidth)
            : 9 / 16;
          const tileH = Math.round(340 * tileRatio);
          const estHeight = 160 + rowCount * (tileH + 115);
          const maxCols = Math.max(3, ...rows.map((r) => r.tiles.length));
          const estWidth = Math.max(1200, 64 + maxCols * 354 + 20);
          return {
            width: estWidth,
            height: estHeight,
          };
        }}
      />
    </>
  );
};
