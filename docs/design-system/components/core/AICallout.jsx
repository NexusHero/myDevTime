import React from 'react';
import { Icon } from './Icon';

/**
 * AI callout — the ONE way AI output appears in the product: gradient
 * hairline (blue→orange, --ai-grad), ✦ chip, body text, optional actions.
 * Deterministic UI never wears this treatment (ADR-0005: AI proposes,
 * you decide — the gradient IS that contract, visually).
 */
export function AICallout({ title, children, action, compact = false }) {
  return (
    <div style={{ borderRadius: 'var(--radius-card)', padding: 1.5, background: 'var(--ai-grad)' }}>
      <div style={{
        borderRadius: 'calc(var(--radius-card) - 1.5px)', background: 'var(--surface)',
        padding: compact ? '10px 14px' : '12px 16px',
        display: 'flex', gap: 11, alignItems: 'center',
      }}>
        <span style={{
          width: 26, height: 26, borderRadius: 8, background: 'var(--ai-grad)', color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-start',
        }}>
          <Icon name="assistant" size={15} />
        </span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-xs)', color: 'var(--ink-2)', lineHeight: 'var(--lh-normal)' }}>
          {title && <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>}
          {children}
        </div>
        {action && <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>{action}</span>}
      </div>
    </div>
  );
}
