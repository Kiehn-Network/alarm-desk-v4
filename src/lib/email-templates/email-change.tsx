import * as React from 'react'
import { Html } from '@react-email/components'
import { EmailLayout } from './_layout'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="de" dir="ltr">
    <EmailLayout
      previewText="Bestätige deine neue E-Mail-Adresse"
      heading="E-Mail-Änderung bestätigen"
      intro={<>Du möchtest deine E-Mail-Adresse für AlarmDesk von <strong>{oldEmail}</strong> auf <strong>{newEmail}</strong> ändern. Bestätige die Änderung über den Button.</>}
      ctaLabel="Änderung bestätigen"
      ctaUrl={confirmationUrl}
      ctaHint="Aus Sicherheitsgründen erhältst du diese Bestätigung an beiden Adressen."
      footerNote="Du hast diese Änderung nicht angefordert? Dann sichere bitte umgehend deinen Zugang ab."
    />
  </Html>
)

export default EmailChangeEmail
