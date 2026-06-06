import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

// AlarmDesk brand palette (hex — email clients don't support oklch/CSS vars)
export const brand = {
  bg: '#ffffff',
  surface: '#0f172a', // dashboard slate-900
  card: '#ffffff',
  border: '#e2e8f0',
  text: '#0f172a',
  muted: '#64748b',
  subtle: '#94a3b8',
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryGlow: '#3b82f6',
  success: '#10b981',
  hairline: '#f1f5f9',
}

interface LayoutProps {
  previewText: string
  heading: string
  intro?: React.ReactNode
  ctaLabel?: string
  ctaUrl?: string
  ctaHint?: React.ReactNode
  children?: React.ReactNode
  footerNote?: React.ReactNode
}

export function EmailLayout({
  previewText,
  heading,
  intro,
  ctaLabel,
  ctaUrl,
  ctaHint,
  children,
  footerNote,
}: LayoutProps) {
  return (
    <>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={outer}>
          {/* Brand header bar */}
          <Section style={header}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tr>
                <td style={{ verticalAlign: 'middle' }}>
                  <table cellPadding={0} cellSpacing={0} role="presentation">
                    <tr>
                      <td style={logoTile}>
                        <Text style={logoMark}>A</Text>
                      </td>
                      <td style={{ paddingLeft: '12px', verticalAlign: 'middle' }}>
                        <Text style={brandName}>AlarmDesk</Text>
                        <Text style={brandTag}>EINSATZVERWALTUNG</Text>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style={{ textAlign: 'right' as const, verticalAlign: 'middle' }}>
                  <span style={statusPill}>● System Online</span>
                </td>
              </tr>
            </table>
          </Section>

          {/* Card */}
          <Section style={card}>
            <Text style={h1}>{heading}</Text>
            {intro && <Text style={lead}>{intro}</Text>}

            {ctaUrl && ctaLabel && (
              <>
                <Section style={{ textAlign: 'center' as const, margin: '32px 0 16px' }}>
                  <Button href={ctaUrl} style={cta}>
                    {ctaLabel} →
                  </Button>
                </Section>
                <Text style={fallbackLabel}>
                  Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:
                </Text>
                <Text style={fallbackLink}>
                  <Link href={ctaUrl} style={fallbackAnchor}>{ctaUrl}</Link>
                </Text>
              </>
            )}

            {ctaHint && <Text style={hint}>{ctaHint}</Text>}
            {children}
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={hr} />
            {footerNote && <Text style={footerText}>{footerNote}</Text>}
            <Text style={footerMeta}>
              © {new Date().getFullYear()} AlarmDesk · Einsatzverwaltung
            </Text>
            <Text style={footerMeta}>
              Diese E-Mail wurde automatisch versendet. Bitte nicht antworten.
            </Text>
          </Section>
        </Container>
      </Body>
    </>
  )
}

const body: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '24px 12px',
}
const outer: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
}
const header: React.CSSProperties = {
  padding: '8px 4px 20px',
}
const logoTile: React.CSSProperties = {
  width: '40px',
  height: '40px',
  background: `linear-gradient(135deg, ${brand.primary}, ${brand.primaryGlow})`,
  borderRadius: '10px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
}
const logoMark: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 800,
  lineHeight: '40px',
  margin: 0,
  textAlign: 'center' as const,
}
const brandName: React.CSSProperties = {
  color: brand.text,
  fontSize: '16px',
  fontWeight: 700,
  margin: 0,
  lineHeight: '20px',
}
const brandTag: React.CSSProperties = {
  color: brand.muted,
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.18em',
  margin: '2px 0 0',
  lineHeight: '12px',
}
const statusPill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 600,
  color: brand.success,
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: '999px',
  padding: '4px 10px',
  letterSpacing: '0.05em',
}
const card: React.CSSProperties = {
  backgroundColor: brand.card,
  border: `1px solid ${brand.border}`,
  borderRadius: '16px',
  padding: '32px 28px',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
}
const h1: React.CSSProperties = {
  color: brand.text,
  fontSize: '24px',
  fontWeight: 700,
  margin: '0 0 12px',
  letterSpacing: '-0.01em',
}
const lead: React.CSSProperties = {
  color: brand.muted,
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 8px',
}
const cta: React.CSSProperties = {
  display: 'inline-block',
  background: `linear-gradient(135deg, ${brand.primary}, ${brand.primaryGlow})`,
  backgroundColor: brand.primary, // fallback for clients ignoring gradient
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  borderRadius: '12px',
  padding: '14px 28px',
  textDecoration: 'none',
  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)',
}
const fallbackLabel: React.CSSProperties = {
  color: brand.subtle,
  fontSize: '12px',
  margin: '20px 0 6px',
  textAlign: 'center' as const,
}
const fallbackLink: React.CSSProperties = {
  margin: '0 0 8px',
  textAlign: 'center' as const,
  wordBreak: 'break-all' as const,
}
const fallbackAnchor: React.CSSProperties = {
  color: brand.primary,
  fontSize: '12px',
  textDecoration: 'underline',
}
const hint: React.CSSProperties = {
  color: brand.muted,
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '20px 0 0',
}
const footer: React.CSSProperties = {
  padding: '20px 4px 0',
  textAlign: 'center' as const,
}
const hr: React.CSSProperties = {
  borderColor: brand.hairline,
  margin: '0 0 16px',
}
const footerText: React.CSSProperties = {
  color: brand.muted,
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}
const footerMeta: React.CSSProperties = {
  color: brand.subtle,
  fontSize: '11px',
  margin: '4px 0 0',
  textAlign: 'center' as const,
}

export const inlineStyles = { brand }