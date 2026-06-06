import * as React from 'react'
import { Html } from '@react-email/components'
import { EmailLayout } from './_layout'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="de" dir="ltr">
    <EmailLayout
      previewText="Dein Login-Link für AlarmDesk"
      heading="Anmelden ohne Passwort"
      intro="Klicke auf den Button, um dich in AlarmDesk anzumelden. Aus Sicherheitsgründen läuft der Link bald ab."
      ctaLabel="Jetzt anmelden"
      ctaUrl={confirmationUrl}
      ctaHint="Der Link ist 15 Minuten gültig und kann nur einmal verwendet werden."
      footerNote="Du hast keinen Login-Link angefordert? Dann ignoriere diese E-Mail."
    />
  </Html>
)

export default MagicLinkEmail
