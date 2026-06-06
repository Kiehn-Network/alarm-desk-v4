import * as React from 'react'
import { Html } from '@react-email/components'
import { EmailLayout } from './_layout'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="de" dir="ltr">
    <EmailLayout
      previewText="Setze dein AlarmDesk-Passwort zurück"
      heading="Passwort zurücksetzen"
      intro="Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Klicke auf den Button, um ein neues Passwort festzulegen."
      ctaLabel="Neues Passwort festlegen"
      ctaUrl={confirmationUrl}
      ctaHint="Der Link ist 60 Minuten gültig und kann nur einmal verwendet werden."
      footerNote="Du hast keinen Reset angefordert? Dann kannst du diese E-Mail ignorieren — dein Passwort bleibt unverändert."
    />
  </Html>
)

export default RecoveryEmail
