import React from 'react';
import { AbsoluteFill } from 'remotion';

export interface BoxOverlay {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}

export interface DiagnosticTile {
  title: string;
  subtitle: string;
  imageDataUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  status: 'PASS' | 'FAIL' | 'INFO';
  boxes: BoxOverlay[];
}

export interface DiagnosticRow {
  rowTitle: string;
  rowStatus: 'PASS' | 'FAIL' | 'INFO';
  rowMetric: string;
  tiles: DiagnosticTile[];
}

export interface DiagnosticSheetProps {
  sheetTitle: string;
  sheetSubtitle: string;
  rows: DiagnosticRow[];
}

const TILE_W = 340;
const STATUS_COLORS = {
  PASS: '#22C55E',
  FAIL: '#EF4444',
  INFO: '#38BDF8',
};

export const DiagnosticSheet: React.FC<DiagnosticSheetProps> = ({
  sheetTitle,
  sheetSubtitle,
  rows,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0D14',
        color: '#F8FAFC',
        fontFamily: 'Segoe UI, system-ui, sans-serif',
        padding: 32,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          borderBottom: '1px solid #1E293B',
          paddingBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 30, fontWeight: 700 }}>{sheetTitle}</div>
          <div style={{ fontSize: 16, color: '#94A3B8', marginTop: 4 }}>
            {sheetSubtitle}
          </div>
        </div>
        <div
          style={{
            fontFamily: 'Consolas, monospace',
            fontSize: 14,
            color: '#94A3B8',
          }}
        >
          UNBROKEN MOTION · VISUAL DIAGNOSTIC
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {rows.map((row, rowIdx) => {
          const badgeColor = STATUS_COLORS[row.rowStatus];
          return (
            <div
              key={rowIdx}
              style={{
                backgroundColor: '#111827',
                border: `1.5px solid ${badgeColor}55`,
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 19, fontWeight: 700 }}>{row.rowTitle}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{
                      fontFamily: 'Consolas, monospace',
                      fontSize: 15,
                      color: '#CBD5E1',
                    }}
                  >
                    {row.rowMetric}
                  </span>
                  <span
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      backgroundColor: `${badgeColor}22`,
                      border: `1px solid ${badgeColor}`,
                      color: badgeColor,
                      fontFamily: 'Consolas, monospace',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {row.rowStatus}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'nowrap' }}>
                {row.tiles.map((tile, tileIdx) => {
                  const scale = TILE_W / Math.max(1, tile.sourceWidth);
                  const tileH = Math.round(tile.sourceHeight * scale);
                  const tileColor = STATUS_COLORS[tile.status];

                  return (
                    <div
                      key={tileIdx}
                      style={{
                        width: TILE_W,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: TILE_W,
                          height: tileH,
                          borderRadius: 6,
                          overflow: 'hidden',
                          border: `2px solid ${tileColor}88`,
                          backgroundColor: '#000',
                        }}
                      >
                        <img
                          src={tile.imageDataUrl}
                          style={{
                            width: TILE_W,
                            height: tileH,
                            display: 'block',
                          }}
                        />
                        {tile.boxes.map((b, bIdx) => (
                          <div
                            key={bIdx}
                            style={{
                              position: 'absolute',
                              left: b.x * scale,
                              top: b.y * scale,
                              width: Math.max(4, b.width * scale),
                              height: Math.max(4, b.height * scale),
                              border: `2px solid ${b.color}`,
                              boxSizing: 'border-box',
                              pointerEvents: 'none',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                top: -18,
                                left: 0,
                                backgroundColor: b.color,
                                color: '#05070B',
                                fontFamily: 'Consolas, monospace',
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '1px 4px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {b.label}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontFamily: 'Consolas, monospace',
                          fontSize: 12,
                          color: '#CBD5E1',
                        }}
                      >
                        <span>{tile.title}</span>
                        <span style={{ color: '#94A3B8' }}>{tile.subtitle}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
