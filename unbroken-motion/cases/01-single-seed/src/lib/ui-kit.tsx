import React from 'react';
import { useBrand } from '../stage/BrandContext.tsx';
import type { EvaluatedActor } from './types.ts';

function BrandSvgMark({
  shape,
  size,
  primary,
  secondary,
  accent,
}: {
  shape: 'prism' | 'orbit' | 'monolith' | 'wave';
  size: number;
  primary: string;
  secondary: string;
  accent: string;
}) {
  if (shape === 'orbit') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="24" stroke={primary} strokeWidth="4" />
        <ellipse
          cx="32"
          cy="32"
          rx="27"
          ry="11"
          transform="rotate(-24 32 32)"
          stroke={secondary}
          strokeWidth="3.5"
        />
        <circle cx="32" cy="32" r="7" fill={accent} />
      </svg>
    );
  }
  if (shape === 'monolith') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <rect x="12" y="10" width="16" height="44" rx="4" fill={primary} />
        <rect x="34" y="18" width="18" height="36" rx="4" fill={secondary} />
        <circle cx="43" cy="12" r="5" fill={accent} />
      </svg>
    );
  }
  if (shape === 'wave') {
    return (
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <path
          d="M8 38C16 20 26 20 32 32C38 44 48 44 56 26"
          stroke={primary}
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M12 46C20 32 28 32 34 40C40 48 48 48 54 36"
          stroke={accent}
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  // prism default
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <polygon points="32,8 56,50 8,50" stroke={primary} strokeWidth="4" fill={`${primary}22`} />
      <polygon points="32,18 46,44 18,44" stroke={accent} strokeWidth="3" fill={`${secondary}33`} />
      <circle cx="32" cy="34" r="4.5" fill={accent} />
    </svg>
  );
}

export const ActorRenderer: React.FC<{ actor: EvaluatedActor }> = ({ actor }) => {
  const brand = useBrand();
  const { width, height, borderRadius } = actor.worldBox;
  const p = actor.props;

  const bg = actor.backgroundColor ?? brand.colors.surface;
  const borderCol = actor.borderColor ?? brand.colors.border;
  const textCol = actor.textColor ?? brand.colors.textPrimary;

  switch (actor.kind) {
    case 'dotSeed': {
      const glow = Number(p.glow ?? 1);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            background: `radial-gradient(circle at 35% 35%, ${brand.colors.accent}, ${bg})`,
            boxShadow: `0 0 ${Math.round(32 * glow)}px ${brand.colors.primary}66`,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
          }}
        />
      );
    }

    case 'commandBar': {
      const promptText = String(p.promptText ?? 'Generate launch workflow...');
      const chipLabel = p.chipLabel ? String(p.chipLabel) : null;
      const showCaret = Boolean(p.showCaret ?? true);
      const caretOpacity = Number(p.caretOpacity ?? 1);
      const contentOpacity = Number(p.contentOpacity ?? 1);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
            boxShadow: `0 20px 54px ${brand.colors.background}88`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 24px',
            gap: 16,
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 99,
              backgroundColor: brand.colors.primary,
              boxShadow: `0 0 14px ${brand.colors.primary}99`,
              flexShrink: 0,
              opacity: contentOpacity,
            }}
          />
          {chipLabel && (
            <div
              style={{
                padding: '6px 14px',
                borderRadius: brand.geometry.radiusSm,
                backgroundColor: `${brand.colors.primary}24`,
                border: `1.5px solid ${brand.colors.primary}`,
                color: brand.colors.primary,
                fontFamily: brand.typography.monoFont,
                fontSize: 18,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                opacity: contentOpacity,
              }}
            >
              {chipLabel}
            </div>
          )}
          <div
            style={{
              fontFamily: brand.typography.bodyFont,
              fontSize: 24,
              fontWeight: brand.typography.bodyWeight,
              color: textCol,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              opacity: contentOpacity,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span>{promptText}</span>
            {showCaret && (
              <span
                style={{
                  display: 'inline-block',
                  width: 3,
                  height: 26,
                  marginLeft: 4,
                  borderRadius: 2,
                  backgroundColor: brand.colors.accent,
                  opacity: caretOpacity,
                }}
              />
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              padding: '8px 16px',
              borderRadius: brand.geometry.radiusSm,
              backgroundColor: brand.colors.primary,
              color: brand.colors.onPrimary,
              fontFamily: brand.typography.bodyFont,
              fontSize: 18,
              fontWeight: 700,
              opacity: contentOpacity,
              whiteSpace: 'nowrap',
            }}
          >
            {String(p.actionLabel ?? 'Run')}
          </div>
        </div>
      );
    }

    case 'appWindow': {
      const title = String(p.title ?? 'Workspace');
      const subtitle = p.subtitle ? String(p.subtitle) : '';
      const activeTab = String(p.activeTab ?? 'Overview');
      const showSkeleton = Boolean(p.showSkeleton ?? true);
      const interiorOpacity = Number(p.interiorOpacity ?? 1);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
            boxShadow: `0 28px 80px ${brand.colors.background}99`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        >
          {/* Layer 1: Minimal Shell Header */}
          <div
            style={{
              height: Math.min(64, height * 0.16),
              borderBottom: `1.5px solid ${brand.colors.border}`,
              backgroundColor: brand.colors.surfaceElevated,
              display: 'flex',
              alignItems: 'center',
              padding: '0 24px',
              gap: 12,
              opacity: interiorOpacity,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 11, height: 11, borderRadius: 99, backgroundColor: brand.colors.border }} />
              <span style={{ width: 11, height: 11, borderRadius: 99, backgroundColor: brand.colors.border }} />
              <span style={{ width: 11, height: 11, borderRadius: 99, backgroundColor: brand.colors.primary }} />
            </div>
            <div
              style={{
                marginLeft: 16,
                fontFamily: brand.typography.headingFont,
                fontWeight: brand.typography.headingWeight,
                fontSize: 22,
                color: brand.colors.textPrimary,
              }}
            >
              {title}
            </div>
            <div style={{ flex: 1 }} />
            <div
              style={{
                padding: '5px 14px',
                borderRadius: brand.geometry.radiusSm,
                backgroundColor: `${brand.colors.secondary}24`,
                color: brand.colors.secondary,
                fontFamily: brand.typography.monoFont,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {activeTab}
            </div>
          </div>

          {/* Layer 2: Clean Semantic Context Body */}
          <div
            style={{
              flex: 1,
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              opacity: interiorOpacity,
            }}
          >
            {subtitle && (
              <div
                style={{
                  fontFamily: brand.typography.bodyFont,
                  fontSize: 20,
                  color: brand.colors.textMuted,
                }}
              >
                {subtitle}
              </div>
            )}
            {showSkeleton && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 6 }}>
                <div
                  style={{
                    width: '62%',
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: `${brand.colors.textMuted}33`,
                  }}
                />
                <div
                  style={{
                    width: '44%',
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: `${brand.colors.textMuted}22`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      );
    }

    case 'card': {
      const title = String(p.title ?? 'Metric');
      const value = p.value !== undefined ? String(p.value) : '';
      const eyebrow = p.eyebrow ? String(p.eyebrow) : '';
      const barRatio = Number(p.barRatio ?? 0);
      const interiorOpacity = Number(p.interiorOpacity ?? 1);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
            boxShadow: `0 18px 46px ${brand.colors.background}77`,
            padding: '24px 28px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div style={{ opacity: interiorOpacity }}>
            {eyebrow && (
              <div
                style={{
                  fontFamily: brand.typography.monoFont,
                  fontSize: 16,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: brand.colors.primary,
                  marginBottom: 8,
                }}
              >
                {eyebrow}
              </div>
            )}
            <div
              style={{
                fontFamily: brand.typography.headingFont,
                fontWeight: brand.typography.headingWeight,
                fontSize: Math.min(34, Math.max(22, height * 0.17)),
                color: textCol,
                lineHeight: 1.15,
              }}
            >
              {title}
            </div>
          </div>
          {value && (
            <div
              style={{
                fontFamily: brand.typography.headingFont,
                fontWeight: brand.typography.headingWeight,
                fontSize: Math.min(54, Math.max(28, height * 0.28)),
                color: brand.colors.primary,
                opacity: interiorOpacity,
              }}
            >
              {value}
            </div>
          )}
          {barRatio > 0 && (
            <div
              style={{
                width: '100%',
                height: 10,
                borderRadius: 99,
                backgroundColor: `${brand.colors.border}88`,
                overflow: 'hidden',
                opacity: interiorOpacity,
              }}
            >
              <div
                style={{
                  width: `${Math.round(Math.max(0, Math.min(1, barRatio)) * 100)}%`,
                  height: '100%',
                  borderRadius: 99,
                  backgroundColor: brand.colors.accent,
                }}
              />
            </div>
          )}
        </div>
      );
    }

    case 'menuRow': {
      const label = String(p.label ?? 'Action');
      const shortcut = p.shortcut ? String(p.shortcut) : '';
      const active = Boolean(p.active ?? false);
      const compactChip = Number(p.chipMode ?? 0);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: active ? brand.colors.primary : bg,
            border: `${brand.geometry.borderWidth}px solid ${active ? brand.colors.accent : borderCol}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: compactChip > 0.5 ? '0 16px' : '0 22px',
            boxSizing: 'border-box',
            boxShadow: active ? `0 12px 32px ${brand.colors.primary}44` : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                backgroundColor: active ? brand.colors.onPrimary : brand.colors.accent,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: brand.typography.bodyFont,
                fontSize: compactChip > 0.5 ? 20 : 23,
                fontWeight: 600,
                color: active ? brand.colors.onPrimary : textCol,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </div>
          {shortcut && compactChip < 0.5 && (
            <span
              style={{
                fontFamily: brand.typography.monoFont,
                fontSize: 16,
                color: active ? brand.colors.onPrimary : brand.colors.textMuted,
              }}
            >
              {shortcut}
            </span>
          )}
        </div>
      );
    }

    case 'chip': {
      const label = String(p.label ?? 'Selected');
      const highlight = Boolean(p.highlight ?? true);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: highlight ? `${brand.colors.primary}22` : bg,
            border: `${brand.geometry.borderWidth}px solid ${highlight ? brand.colors.primary : borderCol}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '0 18px',
            boxSizing: 'border-box',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 99,
              backgroundColor: brand.colors.accent,
            }}
          />
          <span
            style={{
              fontFamily: brand.typography.monoFont,
              fontSize: 19,
              fontWeight: 600,
              color: highlight ? brand.colors.primary : textCol,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
        </div>
      );
    }

    case 'button': {
      const label = String(p.label ?? 'Deploy');
      const pressed = Boolean(p.pressed ?? false);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: brand.typography.headingFont,
            fontWeight: brand.typography.headingWeight,
            fontSize: 22,
            color: textCol,
            transform: pressed ? 'scale(0.95)' : undefined,
            boxShadow: `0 12px 30px ${brand.colors.primary}44`,
          }}
        >
          {label}
        </div>
      );
    }

    case 'metricBadge': {
      const label = String(p.label ?? 'PASS');
      const value = p.value ? String(p.value) : '';
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            padding: '0 22px',
            boxSizing: 'border-box',
            boxShadow: `0 14px 36px ${brand.colors.background}77`,
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 99,
              backgroundColor: brand.colors.accent,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: brand.typography.monoFont,
              fontSize: 20,
              fontWeight: 700,
              color: textCol,
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </span>
          {value && (
            <span
              style={{
                fontFamily: brand.typography.headingFont,
                fontSize: 24,
                fontWeight: brand.typography.headingWeight,
                color: brand.colors.primary,
                whiteSpace: 'nowrap',
              }}
            >
              {value}
            </span>
          )}
        </div>
      );
    }

    case 'cursor': {
      const clicking = Number(p.clickRipple ?? 0);
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {clicking > 0 && (
            <div
              style={{
                position: 'absolute',
                left: -18,
                top: -18,
                width: 48,
                height: 48,
                borderRadius: 99,
                border: `3px solid ${brand.colors.accent}`,
                transform: `scale(${0.6 + clicking * 1.4})`,
                opacity: Math.max(0, 1 - clicking),
              }}
            />
          )}
          <svg width={width} height={height} viewBox="0 0 36 36" fill="none">
            <path
              d="M5 4L14 31L18.5 19.5L30 15L5 4Z"
              fill={brand.colors.textPrimary}
              stroke={brand.colors.background}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      );
    }

    case 'phoneFrame': {
      const title = String(p.title ?? 'Mobile App');
      const interiorOpacity = Number(p.interiorOpacity ?? 1);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth * 2}px solid ${borderCol}`,
            boxShadow: `0 28px 72px ${brand.colors.background}99`,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: 96,
              height: 10,
              borderRadius: 99,
              backgroundColor: brand.colors.border,
              marginBottom: 24,
              opacity: interiorOpacity,
            }}
          />
          <div
            style={{
              fontFamily: brand.typography.headingFont,
              fontWeight: brand.typography.headingWeight,
              fontSize: 30,
              color: textCol,
              opacity: interiorOpacity,
            }}
          >
            {title}
          </div>
        </div>
      );
    }

    case 'tetherBeam': {
      const angleDeg = Number(p.angleDeg ?? 0);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            background: `linear-gradient(${angleDeg}deg, ${brand.colors.primary}, ${brand.colors.accent})`,
            boxShadow: `0 0 24px ${brand.colors.primary}88`,
          }}
        />
      );
    }

    case 'brandMark': {
      const showWordmark = Boolean(p.showWordmark ?? true);
      const showTagline = Boolean(p.showTagline ?? true);
      const markSize = Math.min(width * 0.25, height * 0.45, 76);
      const clearSpace = Math.round(markSize * brand.logo.minClearSpaceRatio);
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius,
            backgroundColor: bg,
            border: `${brand.geometry.borderWidth}px solid ${borderCol}`,
            padding: clearSpace,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <BrandSvgMark
              shape={brand.logo.markShape}
              size={markSize}
              primary={brand.colors.primary}
              secondary={brand.colors.secondary}
              accent={brand.colors.accent}
            />
            {showWordmark && (
              <span
                style={{
                  fontFamily: brand.typography.headingFont,
                  fontWeight: brand.typography.headingWeight,
                  fontSize: Math.max(30, markSize * 0.62),
                  letterSpacing: '0.08em',
                  color: textCol,
                }}
              >
                {brand.logo.wordmark}
              </span>
            )}
          </div>
          {showTagline && brand.logo.tagline && (
            <div
              style={{
                fontFamily: brand.typography.bodyFont,
                fontSize: 22,
                color: brand.colors.textMuted,
              }}
            >
              {brand.logo.tagline}
            </div>
          )}
        </div>
      );
    }

    case 'headline': {
      const text = String(p.text ?? '');
      const subtext = p.subtext ? String(p.subtext) : '';
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: brand.typography.headingFont,
              fontWeight: brand.typography.headingWeight,
              fontSize: Number(p.fontSize ?? 48),
              color: textCol,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            {text}
          </div>
          {subtext && (
            <div
              style={{
                fontFamily: brand.typography.bodyFont,
                fontSize: Number(p.subFontSize ?? 24),
                color: brand.colors.textMuted,
              }}
            >
              {subtext}
            </div>
          )}
        </div>
      );
    }

    default:
      return null;
  }
};
