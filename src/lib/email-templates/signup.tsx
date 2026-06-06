import * as React from 'react'
import { Html } from '@react-email/components'
import { EmailLayout } from './_layout'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="de" dir="ltr">
    <EmailLayout
      previewText="Bestätige deine E-Mail-Adresse für AlarmDesk"
      heading="E-Mail-Adresse bestätigen"
      intro={<>Willkommen bei AlarmDesk. Bestätige die Adresse <strong>{recipient}</strong>, um deinen Zugang zur Einsatzverwaltung zu aktivieren.</>}
      ctaLabel="E-Mail bestätigen"
      ctaUrl={confirmationUrl}
      ctaHint="Der Link ist aus Sicherheitsgründen 24 Stunden gültig."
      footerNote="Du hast keinen Zugang angefordert? Dann ignoriere diese E-Mail einfach."
    />
  </Html>
)

export default SignupEmail
