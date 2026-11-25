import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';

function Item({ children }: { children: string }) {
  return <Text style={styles.item}>{`•  ${children}`}</Text>;
}

export default function Privacy() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy</Text>
      <Text style={styles.updated}>Effective November 24, 2026</Text>
      <Text style={styles.body}>
        This policy explains how Diamond CM LLC, an Arizona limited liability company (“we,” “us,” or “our”), handles information when you use My Rental Fleet. It should be read with the Terms and Conditions. If a word is defined there, the same meaning applies here.
      </Text>

      <Text style={styles.heading}>1. Who this policy covers</Text>
      <Text style={styles.body}>
        This policy covers the operator who uses the Service. It also describes information that operator may store about a renter or another person, such as a name in a rental record or a person who appears in a photo or video. Renters do not usually have their own account. If you are a renter and you have a question about a record, contact the operator who made it. You may also contact us at support@my-rental-fleet.com, and we will point you to the account holder where we can.
      </Text>
      <Text style={styles.body}>
        The Service is intended for users in the United States. If you use it from another country, you understand that your information will be processed in the United States.
      </Text>

      <Text style={styles.heading}>2. Information we collect</Text>
      <Text style={styles.body}>
        Account information. We collect the email address, password, and account identifiers needed to sign you in. Passwords are handled by our authentication provider. We do not ask you to send us a password by email. We store whether the email address has been confirmed.
      </Text>
      <Text style={styles.body}>
        Fleet and inspection records. You may store a machine's nickname, year, make, model, VIN or boat hull number, status, and cover photo. A rental record may include the renter's name, miles or hours, fuel, notes, an issue mark, photos, a walk-around video with sound, and times. A maintenance record may include a description of the work, miles or hours, a cost, notes, receipt photos, and times.
      </Text>
      <Text style={styles.body}>
        Times. We store the time reported by your device and, when the device connects, the time our server receives the record or file. We use those times as part of the record and to count the 365-day rental period.
      </Text>
      <Text style={styles.body}>
        Device and connection information. We receive ordinary technical data needed to run the Service, such as whether the device is online, an IP address when you contact our servers, the kind of browser or app, and the page address inside the Service. The Service does not collect GPS or precise location. It does not use advertising cookies. The website keeps you signed in, and keeps unfinished inspection drafts and not-yet-uploaded files, in the browser's local storage and a local database on the device.
      </Text>
      <Text style={styles.body}>
        Problem reports. If the Service hits an error, it may automatically send us a problem report. The report can include your email address, your account identifier, the page you were on, and a short description of the error. It is stored with our text records, and a notice is emailed to our support address. We use it to find and fix problems. We do not send a report for an ordinary message such as a wrong password, a video that is too large, or a file that is waiting for a connection.
      </Text>
      <Text style={styles.body}>
        Payment information. When subscriptions are offered through the Apple App Store or Google Play, the store collects and processes payment. We receive subscription status and a store transaction identifier. We do not receive your full payment-card number.
      </Text>
      <Text style={styles.body}>Support messages. If you email us, we keep the message and our reply.</Text>
      <Text style={styles.body}>We do not buy personal information, and we do not build advertising profiles from the Service.</Text>

      <Text style={styles.heading}>3. How we use information</Text>
      <Text style={styles.body}>We use information to:</Text>
      <Item>provide, secure, and fix the Service;</Item>
      <Item>store your fleet, inspection, and maintenance records and show them to you;</Item>
      <Item>upload files that were saved on the device while it was offline;</Item>
      <Item>delete rental records and their photos and videos about 365 days after the server receives them;</Item>
      <Item>look up a VIN you submit, when you ask the Service to identify a vehicle;</Item>
      <Item>send a share link or a password-reset email you request;</Item>
      <Item>send a problem notice to our support address;</Item>
      <Item>charge for a subscription through the app store, when billing is on;</Item>
      <Item>answer support requests and send service notices;</Item>
      <Item>investigate abuse, fraud, and security problems;</Item>
      <Item>meet legal duties.</Item>
      <Text style={styles.body}>We do not sell your personal information. We do not share it for cross-context behavioral advertising.</Text>

      <Text style={styles.heading}>4. Where information is stored</Text>
      <Text style={styles.body}>
        Text records, accounts, and problem reports are stored with Google Firebase. Photos and video are stored with Cloudflare R2. A share link is a text file stored with Cloudflare. A copy of a recent record, and files that have not uploaded yet, can also sit on your device. Problem-notice email goes through FormSubmit. Vendors process this information for us, under their own terms and security duties, and only to provide the Service.
      </Text>
      <Text style={styles.body}>Those vendors may store data in the United States.</Text>

      <Text style={styles.heading}>5. How long we keep information</Text>
      <Text style={styles.body}>
        Rental records and the photos and videos attached to them are deleted from the Service about 365 days after our server receives the rental record. If the record was created offline, the period starts when the server receives it. Rental photos and videos are removed by a daily cleanup about 365 days after each file is stored, even if the app is not opened. The written rental card is removed when the account next syncs after the period. Save your own copy if you need it longer.
      </Text>
      <Text style={styles.body}>
        A share link is not deleted on that schedule. It can remain available to anyone who has the link. A file someone already saved from a link is outside our systems.
      </Text>
      <Text style={styles.body}>
        Maintenance records, including receipt photos, stay until you delete them, or until the machine or the account is deleted. They are not deleted on the rental schedule.
      </Text>
      <Text style={styles.body}>
        Problem reports are kept long enough to investigate and fix the problem, and then for as long as we need them for security or a legal claim. They are not kept as part of the rental record.
      </Text>
      <Text style={styles.body}>
        If you delete a machine, we delete the stored records and media for that machine from the Service. If you close your account, we will delete or de-identify the account data and stored records, except for information we must keep for security, fraud prevention, tax, accounting, or legal claims, and except for short-lived backups. Closing the account does not cancel an app-store subscription.
      </Text>
      <Text style={styles.body}>
        Files that remain only on your device are under your control. Removing the app, or losing the device before an upload finishes, can delete those local files.
      </Text>

      <Text style={styles.heading}>6. When we share information</Text>
      <Text style={styles.body}>We share information only in these cases:</Text>
      <Item>Vendors that host the Service, including Google Firebase, Cloudflare, FormSubmit for problem-notice email, and, for a paid app, Apple or Google.</Item>
      <Item>A VIN lookup you start. The VIN is sent to NHTSA's public decoder. A hull number is not sent.</Item>
      <Item>A link you create. Anyone with the link can open that card. The link does not open the rest of your account, and it does not expire on its own.</Item>
      <Item>Legal reasons. We may share information if we believe in good faith that the law, a court order, or a government request requires it, or if it is needed to protect a person, the Service, or our rights.</Item>
      <Item>A business transfer. If the Service is sold or merged, records can transfer to the new owner under this policy. We will tell you if the law requires notice.</Item>
      <Text style={styles.body}>We do not share your fleet records with other customers. We do not sell personal information.</Text>

      <Text style={styles.heading}>7. Security</Text>
      <Text style={styles.body}>
        We use access controls, encrypted connections, and vendor security tools that are reasonable for a service of this size. No method of storage or transmission is perfectly secure. You should protect the phone that holds offline copies, the email account you use to sign in, and any share link you send.
      </Text>
      <Text style={styles.body}>
        If we discover a breach of personal information that the law requires us to disclose, we will notify the people and authorities the law requires us to notify.
      </Text>

      <Text style={styles.heading}>8. Your choices</Text>
      <Text style={styles.body}>
        You can review and correct fleet and inspection information in the Service. You can delete a photo during an inspection, delete a record, or delete a machine and the files stored with it. You can save a copy of a card before it is deleted. You can delete the account in the app, or ask us to close it by emailing support@my-rental-fleet.com.
      </Text>
      <Text style={styles.body}>
        Depending on where you live in the United States, you may have a right to know, to access, to correct, or to delete personal information, a right to appeal a refusal, and a right to opt out of the sale or sharing of personal information. We do not sell personal information and we do not share it for cross-context behavioral advertising. We will not discriminate against you for using a privacy right.
      </Text>
      <Text style={styles.body}>
        To ask, email support@my-rental-fleet.com. We may need to confirm that you control the account. An authorized agent may submit a request if the law allows it and the agent shows authority. If we deny a request, we will explain why, unless the law forbids that, and we will tell you how to appeal if an appeal right applies.
      </Text>

      <Text style={styles.heading}>9. Children</Text>
      <Text style={styles.body}>
        The Service is not for children under 13. We do not knowingly collect personal information from a child under 13. If you believe a child has given us personal information, email support@my-rental-fleet.com and we will delete it.
      </Text>

      <Text style={styles.heading}>10. Changes to this policy</Text>
      <Text style={styles.body}>
        We may update this policy. We will change the effective date and, if a change is material, give the notice the law requires. The new policy applies to the Service from that date.
      </Text>

      <Text style={styles.heading}>11. Contact</Text>
      <Text style={styles.body}>Privacy questions and requests go to:</Text>
      <Text style={styles.body}>Diamond CM LLC</Text>
      <Text style={styles.body}>85 W Combs Rd, Ste 101, PMB 251</Text>
      <Text style={styles.body}>San Tan Valley, AZ 85140</Text>
      <Text style={styles.body}>support@my-rental-fleet.com</Text>
      <Pressable onPress={() => router.push('/terms')}>
        <Text style={styles.link}>Terms and conditions</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 22, paddingBottom: 48, maxWidth: 640, alignSelf: 'center', width: '100%' },
  title: { color: theme.text, fontSize: 32, fontWeight: '800' },
  updated: { color: theme.muted, marginTop: 6, marginBottom: 16 },
  heading: { color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 22, marginBottom: 8 },
  body: { color: theme.text, fontSize: 16, lineHeight: 24, marginTop: 8 },
  item: { color: theme.text, fontSize: 16, lineHeight: 24, marginTop: 6, paddingLeft: 8 },
  link: { color: theme.accent, fontSize: 16, fontWeight: '800', marginTop: 16 },
});
