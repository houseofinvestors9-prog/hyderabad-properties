import { ImageResponse } from 'next/og';

// Share card for WhatsApp, LinkedIn and X. Pages without their own image inherit this one.
export const alt = 'hyderabad.properties: check any Hyderabad project before you buy';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const CHECKS = ['RERA registration', 'Building approvals', 'Lake buffer zones', 'True cost'];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: '#ffffff',
          color: '#212121',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
            <path
              d="M3.5 10.2 12 3.5l8.5 6.7V20a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-9.8Z"
              stroke="#212121"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
          <div style={{ fontSize: 34, fontWeight: 600 }}>hyderabad.properties</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 600, lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: 980 }}>
            Check any Hyderabad project before you buy
          </div>
          <div style={{ fontSize: 30, color: '#6b6b6b' }}>Free checks built from government records, explained in plain words.</div>
        </div>

        <div style={{ display: 'flex', gap: 14 }}>
          {CHECKS.map((c) => (
            <div
              key={c}
              style={{
                display: 'flex',
                fontSize: 24,
                padding: '12px 24px',
                borderRadius: 999,
                border: '2px solid #eeeeee',
                color: '#212121',
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
