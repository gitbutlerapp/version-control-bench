import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

// Favicon: the OG image's brand mark reduced to a glyph — dark panel,
// amber accent bar, and the pass-check that anchors the results matrix.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d1014',
          borderRadius: 12,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 8,
            top: 14,
            width: 6,
            height: 36,
            background: '#f4a623',
          }}
        />
        {/* drawn as a path: the bundled og font has no U+2713 glyph */}
        <svg width="34" height="34" viewBox="0 0 34 34" style={{ marginLeft: 10 }}>
          <path
            d="M4 18 L13 27 L30 7"
            fill="none"
            stroke="#46b17b"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
