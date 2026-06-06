import * as React from 'react'
import { Html, Text } from '@react-email/components'
import { EmailLayout } from './_layout'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="de" dir="ltr">
    <EmailLayout
      previewText="Dein AlarmDesk-Verifizierungscode"
      heading="Identität bestätigen"
      intro="Gib den folgenden Code in AlarmDesk ein, um deine Identität zu bestätigen:"
      ctaHint="Der Code ist 10 Minuten gültig."
      footerNote="Du hast diese Aktion nicht ausgelöst? Dann ignoriere diese E-Mail."
    >
      <Text style={code}>{token}</Text>
    </EmailLayout>
  </Html>
)

export default ReauthenticationEmail

const code: React.CSSProperties = {
  fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
  fontSize: '32px',
  fontWeight: 700,
  letterSpacing: '0.4em',
  color: '#2563eb',
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '12px',
  padding: '18px 24px',
  textAlign: 'center' as const,
  margin: '24px 0 8px',
}
