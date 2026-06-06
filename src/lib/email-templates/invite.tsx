import * as React from 'react'
import { Html } from '@react-email/components'
import { EmailLayout } from './_layout'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <Html lang="de" dir="ltr">
    <EmailLayout
      previewText="Du wurdest zu AlarmDesk eingeladen"
      heading="Willkommen im Team"
      intro="Du wurdest zur Einsatzverwaltung AlarmDesk eingeladen. Klicke auf den Button, um die Einladung anzunehmen und deinen Zugang einzurichten."
      ctaLabel="Einladung annehmen"
      ctaUrl={confirmationUrl}
      ctaHint="Im nächsten Schritt vergibst du dein persönliches Passwort."
      footerNote="Du hast diese Einladung nicht erwartet? Dann kannst du diese E-Mail ignorieren."
    />
  </Html>
)

export default InviteEmail
