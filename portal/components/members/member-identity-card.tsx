'use client';

import { forwardRef, type CSSProperties } from 'react';
import { type MemberIdentityCardData } from '@/lib/members/identity-card';
import { formatWardNoLabel } from '@/lib/members/ward-numbers';

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const clamp2: CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
};

const clamp1: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const MemberIdentityCard = forwardRef<
  HTMLDivElement,
  { data: MemberIdentityCardData; className?: string }
>(function MemberIdentityCard({ data, className }, ref) {
  const wardLabel =
    data.wardNo === null || data.wardNo === undefined
      ? null
      : formatWardNoLabel(data.wardNo);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        width: 428,
        height: 270,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        background: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid #dbe3ef',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
        color: '#0f172a',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          padding: '10px 14px',
          boxSizing: 'border-box',
          background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
          color: '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <img
            src="/mpa-logo.png"
            alt="MPA Logo"
            width={38}
            height={38}
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              objectFit: 'cover',
              border: '2px solid rgba(255,255,255,0.35)',
              background: '#ffffff',
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: 1.1, opacity: 0.85, fontWeight: 600 }}>
              MPA MEMBERSHIP
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.15 }}>Identity Card</div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.3,
              padding: '4px 10px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.18)',
              border: '1px solid rgba(255,255,255,0.28)',
              ...clamp1,
              maxWidth: 140,
            }}
          >
            Mid : {data.memberId}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              textTransform: 'capitalize',
            }}
          >
            {statusLabel(data.status)}
          </div>
        </div>
      </div>

      {/* Body — grows; address stays below without overlapping */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '12px 14px 8px',
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: 84,
            alignSelf: 'stretch',
            maxHeight: 118,
            borderRadius: 10,
            overflow: 'hidden',
            border: '2px solid #dbe3ef',
            background: '#f8fafc',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt={data.fullName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: 11, padding: 8 }}>
              No Photo
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              lineHeight: 1.2,
              textTransform: 'uppercase',
              flexShrink: 0,
              ...clamp2,
            }}
          >
            {data.fullName}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              columnGap: 12,
              rowGap: 8,
              fontSize: 11,
              flexShrink: 0,
            }}
          >
            <IdentityField label="Phone" value={data.phone} />
            <IdentityField label="Blood Group" value={data.bloodGroup} />
            <IdentityField label="Ward No." value={wardLabel} />
            <IdentityField label="Nominee" value={data.nominee} />
          </div>
        </div>
      </div>

      {/* Address footer */}
      <div
        style={{
          margin: '0 14px 12px',
          padding: '8px 10px',
          boxSizing: 'border-box',
          borderRadius: 10,
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          fontSize: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 2 }}>Permanent Address</div>
        <div style={{ fontWeight: 600, lineHeight: 1.35, ...clamp2 }}>
          {data.permanentAddress || '—'}
        </div>
      </div>
    </div>
  );
});

function IdentityField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: '#64748b', fontWeight: 600, marginBottom: 1, fontSize: 10 }}>{label}</div>
      <div style={{ fontWeight: 600, lineHeight: 1.25, fontSize: 12, ...clamp1 }}>{value || '—'}</div>
    </div>
  );
}
