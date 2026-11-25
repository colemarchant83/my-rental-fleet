import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../theme';

function Item({ children }: { children: string }) {
  return <Text style={styles.item}>{`•  ${children}`}</Text>;
}

export default function Terms() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms</Text>
      <Text style={styles.updated}>Effective November 24, 2026</Text>
      <Text style={styles.body}>
        These Terms and Conditions are an agreement between you and Diamond CM LLC, an Arizona limited liability company (“we,” “us,” or “our”), for the My Rental Fleet website and apps (the “Service”). By creating an account, paying for the Service, or using the Service, you agree to these terms. If you do not agree, do not use the Service.
      </Text>
      <Text style={styles.body}>
        If you use the Service for a company or another person, you confirm that you have authority to bind that company or person. “You” includes that company or person.
      </Text>

      <Text style={styles.heading}>1. What the Service is</Text>
      <Text style={styles.body}>
        The Service is a tool for rental operators to keep records about their own fleet. You can add machines, vehicles, or boats; record a pre-rental inspection and a return inspection; store photos, video, notes, and meter readings; keep a maintenance log; and save or share a copy of a record.
      </Text>
      <Text style={styles.body}>
        The Service is not a rental contract. It is not insurance. It is not a law firm, and it does not give legal, tax, or insurance advice. We are not a party to any rental between you and your customer. You are responsible for your own rental agreement, your prices, your insurance, and your compliance with the law.
      </Text>
      <Text style={styles.body}>
        A record in the Service is not a certified copy, a chain of custody, or a guarantee that a court, insurer, or other person will accept it. You should keep your own copy of any record you may need later.
      </Text>

      <Text style={styles.heading}>2. Who may use the Service</Text>
      <Text style={styles.body}>
        The Service is offered to business operators in the United States. You must be at least 18 years old and able to form a contract. The Service is not directed to children under 13, and children under 13 may not use it.
      </Text>
      <Text style={styles.body}>
        You must use the Service only for machines you own, manage, or have permission to document. You must not use another person's fleet, records, or account.
      </Text>

      <Text style={styles.heading}>3. Accounts</Text>
      <Text style={styles.body}>
        You need an account to use the Service. You agree to give an accurate email address and to keep your login private. You are responsible for activity under your account, including activity by someone you allow to use it. Tell us promptly at support@my-rental-fleet.com if you believe someone else is using your account.
      </Text>
      <Text style={styles.body}>
        A new account must confirm the email address before it can be used. We may refuse, suspend, or close an account that breaks these terms, creates a security risk, or is unused for a long period after notice, where notice is practical.
      </Text>
      <Text style={styles.body}>
        Your records are tied to the account. A phone can also keep a local copy for offline use. Signing out, deleting the app, or losing the phone can remove a local copy that has not finished uploading.
      </Text>
      <Text style={styles.body}>
        Deleting an account erases the machines, rental cards, maintenance records, photos, and videos stored with that account in the Service. The same email can be used later, but it will be a new empty account. Deleting an account, or deleting the app, does not cancel a subscription. A subscription must be canceled through the phone's subscription settings or the app store.
      </Text>

      <Text style={styles.heading}>4. Your records</Text>
      <Text style={styles.body}>
        You keep ownership of the text, photos, video, and other material you submit (“Your Content”). You give us a limited permission to host, copy, back up, display, transmit, and delete Your Content only as needed to run the Service, to follow these terms, and to follow the law. That permission ends when Your Content is deleted from our systems, except for copies that already left our systems, such as a file you saved to your own phone, a file someone already downloaded, or a share link that is still open.
      </Text>
      <Text style={styles.body}>
        You promise that you have the rights you need to upload Your Content, and that Your Content does not break the law or these terms.
      </Text>
      <Text style={styles.body}>
        A record may include a renter's name, a VIN, a boat hull number, meter readings, notes, photos, and video. You are responsible for what you collect about your renters and for telling them what you collect, if the law requires that.
      </Text>

      <Text style={styles.heading}>5. Photos, video, sound, and other people</Text>
      <Text style={styles.body}>
        Inspection photos and video are meant to show the condition of a machine. They can also show people, license plates, addresses, or other private details if those things are in the picture. Walk-around video recorded in the Service can include sound.
      </Text>
      <Text style={styles.body}>
        You are responsible for complying with the recording and privacy laws of the place where you record. Those laws differ. Some places require every person in a conversation to consent before the conversation is recorded. Do not record a person, a private conversation, or a place when you do not have a right to do so. Do not use the Service to harass, watch, or embarrass anyone.
      </Text>
      <Text style={styles.body}>
        Video recorded in the Service is taken in the app, at a quality we set, so that files stay a practical size. A video that is too large is kept on the device and is not uploaded. A photo chosen from the phone's library may be a higher resolution. You are responsible for the files you choose to add.
      </Text>

      <Text style={styles.heading}>6. Timestamps are records, not a court guarantee</Text>
      <Text style={styles.body}>
        The Service stores the time reported by the device when a record or file is created. If the device is offline, the server time is stored when the device next connects. Those times are kept so you have a record. They are not a promise that a court, insurer, or other person will accept the record, or that the record cannot be questioned.
      </Text>
      <Text style={styles.body}>
        A time can be wrong if the device clock is wrong, if the device is offline, or if a file is interrupted. A file name or a copy that you save outside the Service can be renamed. We do not control copies after they leave the Service. The one-year deletion period in section 8 is counted from the server time, not from the device clock.
      </Text>

      <Text style={styles.heading}>7. Offline use</Text>
      <Text style={styles.body}>
        You must sign in on a phone while that phone has an internet connection before the Service can be used offline on it. Opening the app without signing in is not enough. A new sign-in, including the first sign-in on a phone, cannot be completed without a connection. If you go to a place with no service before you have signed in on that phone, the Service will not open.
      </Text>
      <Text style={styles.body}>
        After that sign-in, rental inspections for machines already saved on that phone can be started and finished without an internet connection. Photos and video taken offline stay on the device until they upload. The website version can upload only while it remains open. The installed phone app is planned to keep uploading after the app is closed. Maintenance pages and adding or deleting a machine need a connection.
      </Text>
      <Text style={styles.body}>
        Offline files can be lost if the phone is lost, reset, or damaged, or if the app is deleted, before the upload finishes. A file can also fail to upload if it is too large or the connection fails. We do not promise that every offline file will upload.
      </Text>

      <Text style={styles.heading}>8. How long we keep rental and maintenance records</Text>
      <Text style={styles.body}>
        Rental inspection records, and the photos and videos that belong to them, are deleted from the Service about 365 days after our server receives the rental record. If the inspection was saved while the device was offline, that period starts when the device next connects and the server receives the record, not from the time shown on the device. The app tells you this before the year ends. If you need a rental record after that, you must save your own copy before the period ends. We do not promise to recover a rental record after it has been deleted.
      </Text>
      <Text style={styles.body}>
        Rental photos and videos are removed by a daily storage cleanup about 365 days after each file is stored, even if you do not open the app. The written rental card is removed when the account next connects after the period ends. Deletion can take a short time after day 365 because the cleanup runs once a day, and because a written card is removed on the next connection.
      </Text>
      <Text style={styles.body}>
        Maintenance records, including receipt photos, stay in the Service until you delete them, or until your account or the related machine is deleted. They are not on the rental schedule. A machine's profile photo is not deleted on that schedule either, unless you delete the machine or the account.
      </Text>
      <Text style={styles.body}>A share link is a separate copy. The one-year cleanup does not delete a share link. Section 9 explains that.</Text>
      <Text style={styles.body}>
        If you delete a machine, we delete that machine and the rental records, maintenance records, photos, and videos stored with it in the Service. Deletion does not erase a copy you already saved to your own phone or computer, a copy someone already downloaded, or a share link that is still open.
      </Text>
      <Text style={styles.body}>
        We may keep a limited record of an account, a payment, a problem report, or a safety or legal matter for as long as we need it for security, tax, accounting, or legal claims. We may also keep short-lived backups until they age out. We do not promise that a backup can be used to restore a record you deleted or a rental that reached the end of the 365 days.
      </Text>

      <Text style={styles.heading}>9. Saving and sharing a card</Text>
      <Text style={styles.body}>
        You can save a rental card or a maintenance card to your own files. You can also make a link and send it by text or email. Anyone who has the link can open that card and save the files. The link does not open the rest of your account. Treat a link like a key. Do not send it to someone who should not see the record.
      </Text>
      <Text style={styles.body}>
        A share link does not expire on its own. It is not removed by the 365-day rental cleanup. It can remain available to anyone who has the link after the rental card itself has been deleted from your account. The link stores a copy of the card's text and the addresses of its files. If you need a link to stop working, do not rely on the one-year cleanup to do that.
      </Text>
      <Text style={styles.body}>
        After you export a copy, or after someone opens a link, we cannot delete that copy from the other person's phone, email, or files. You are responsible for what you send.
      </Text>

      <Text style={styles.heading}>10. Plans, price, and app stores</Text>
      <Text style={styles.body}>
        Billing is not turned on. No free trial is currently offered. Until a price is shown in the app store and you subscribe, nothing in this section is a charge.
      </Text>
      <Text style={styles.body}>When paid use is offered, it is a monthly subscription:</Text>
      <Item>$29.99 per month for up to 5 machines.</Item>
      <Item>$49.99 per month for up to 10 machines.</Item>
      <Item>$99.99 per month for up to 30 machines.</Item>
      <Text style={styles.body}>
        A yard with more than 30 machines is not covered by these prices. Those prices have to be confirmed in the app store listing before they are charged. Taxes may be added where required.
      </Text>
      <Text style={styles.body}>
        If you subscribe through the Apple App Store or Google Play, that store processes the payment. The subscription renews automatically each month until you cancel. Cancel in the store's subscription settings at least 24 hours before the renewal. Deleting the app, or deleting the account inside the app, does not cancel the subscription. The store's rules control the charge, the renewal, the cancellation, and any refund. We do not receive your full card number from the store.
      </Text>
      <Text style={styles.body}>
        We may change the price or the plan. If we do, we will tell you before the change applies to a renewal, as required by the store and by law. If a free trial is added later, we will say how long it lasts, when it converts to a paid subscription, and what records are deleted if you do not subscribe. We will not delete records under a trial rule that has not been shown to you.
      </Text>

      <Text style={styles.heading}>11. Acceptable use</Text>
      <Text style={styles.body}>You agree not to:</Text>
      <Item>break the law, or help someone else break the law, with the Service;</Item>
      <Item>upload content you do not have a right to upload;</Item>
      <Item>record a person or a conversation when the law, or that person's rights, do not allow it;</Item>
      <Item>use the Service to harm, stalk, or threaten a person;</Item>
      <Item>try to break, probe, or overload the Service, or to get into another customer's records;</Item>
      <Item>resell the Service or scrape it, except with our written permission;</Item>
      <Item>misrepresent a record, a time, or a photo as something it is not;</Item>
      <Item>upload unlawful images, including sexual content involving a minor.</Item>

      <Text style={styles.heading}>12. VIN and hull numbers</Text>
      <Text style={styles.body}>
        If you enter a vehicle identification number, we may send that number to the National Highway Traffic Safety Administration's public VIN decoder to suggest a year, make, and model. That suggestion can be wrong or incomplete. You must check it before you rely on it. A boat hull number is stored as you enter it. We do not look it up, and we do not fill in the boat's make or model from it.
      </Text>

      <Text style={styles.heading}>13. Our intellectual property</Text>
      <Text style={styles.body}>
        We own the Service, including its software, design, and the My Rental Fleet name and icon, apart from Your Content and apart from third-party names. The name and icon may be the subject of a trademark application. A pending application is not a registration. We give you a personal, limited, revocable, non-exclusive license to use the Service while you follow these terms and, when billing is on, while your subscription is active. You may not copy the software, reverse engineer it except where the law forbids that limit, or use our name in a way that suggests we endorse you.
      </Text>
      <Text style={styles.body}>
        If you send us a suggestion, you give us permission to use it without paying you. You keep the rights you already have in Your Content.
      </Text>
      <Text style={styles.body}>
        If you believe content in the Service infringes a copyright, email support@my-rental-fleet.com with the address of the content, a description of the copyrighted work, your contact information, and a statement that you believe the use is not authorized. We will review it. This contact is not, by itself, a designation of a copyright agent under the Digital Millennium Copyright Act.
      </Text>

      <Text style={styles.heading}>14. Third-party services</Text>
      <Text style={styles.body}>
        The Service depends on other companies, including Google (Firebase) for accounts and text records, Cloudflare for photo and video storage, and Apple or Google for app-store distribution and payments. Problem-notice email is sent through FormSubmit to our support address. A VIN lookup depends on NHTSA. Their outages and their terms can affect the Service. We are not responsible for a third-party service we do not control.
      </Text>

      <Text style={styles.heading}>15. Disclaimers</Text>
      <Text style={styles.body}>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE FULL EXTENT ALLOWED BY LAW, WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT, AND ANY WARRANTY THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, THAT A FILE WILL UPLOAD, THAT A RECORD WILL BE KEPT LONGER THAN THESE TERMS SAY, OR THAT A RECORD WILL BE ACCEPTED AS EVIDENCE.
      </Text>
      <Text style={styles.body}>Some states do not allow some of these disclaimers. In those states, the disclaimers apply only as far as the law allows.</Text>

      <Text style={styles.heading}>16. Limitation of liability</Text>
      <Text style={styles.body}>
        TO THE FULL EXTENT ALLOWED BY LAW, DIAMOND CM LLC AND ITS OWNERS, EMPLOYEES, AND CONTRACTORS WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST RECORDS, LOST GOODWILL, OR A RENTAL DISPUTE BETWEEN YOU AND YOUR CUSTOMER, EVEN IF WE WERE TOLD THOSE DAMAGES WERE POSSIBLE.
      </Text>
      <Text style={styles.body}>
        TO THE FULL EXTENT ALLOWED BY LAW, OUR TOTAL LIABILITY FOR A CLAIM ARISING OUT OF THE SERVICE WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM, OR ONE HUNDRED DOLLARS. This limit does not apply where the law does not allow it, including liability that cannot legally be limited.
      </Text>

      <Text style={styles.heading}>17. Your responsibility for claims</Text>
      <Text style={styles.body}>
        You will defend and indemnify Diamond CM LLC and its owners, employees, and contractors against a claim, loss, or expense, including reasonable lawyers' fees, that comes from Your Content, a recording you make, your rental business, a record you share, your use of the Service, or your break of these terms. We may control the defense of a claim that asks us to do so. You will cooperate. This section does not apply to a claim caused by our own willful misconduct, or where the law does not allow this kind of promise.
      </Text>

      <Text style={styles.heading}>18. Stopping the Service</Text>
      <Text style={styles.body}>
        You may stop using the Service at any time. If you subscribed through an app store, cancel there. We may suspend or stop the Service, or your access, if you break these terms, if a payment that is due is not paid after notice, if we must do so for security or law, or if we stop offering the Service. If we stop the Service for our own business reasons, we will give a reasonable notice when we can, so you can export records that are still available.
      </Text>
      <Text style={styles.body}>
        We are not liable for a delay or failure caused by a power or network outage, a failure of a vendor named in these terms, a natural disaster, a labor dispute, a war, a government action, or another event outside our reasonable control.
      </Text>
      <Text style={styles.body}>
        Sections that should survive, including ownership, record retention, disclaimers, liability limits, indemnity, and disputes, stay in effect.
      </Text>

      <Text style={styles.heading}>19. Changes to these terms</Text>
      <Text style={styles.body}>
        We may change these terms. If a change is material, we will post the new terms and update the effective date, and we will give any extra notice the law or the app store requires. If you keep using the Service after the effective date, you accept the new terms. If you do not accept them, stop using the Service and, if you have a subscription, cancel it.
      </Text>

      <Text style={styles.heading}>20. Disputes, law, and notices</Text>
      <Text style={styles.body}>
        These terms are governed by the laws of the State of Arizona, not including conflict-of-law rules. Courts in Maricopa County, Arizona, are the venue for a dispute that is not required to be heard somewhere else. You and we consent to those courts. If the law where you live does not allow a business-operator contract to set that venue, that law controls for that limit only. These terms do not require arbitration, and they do not waive a class action.
      </Text>
      <Text style={styles.body}>
        Before filing a claim, you agree to email support@my-rental-fleet.com with a short description of the dispute and to give us 30 days to try to resolve it. Either of us may still seek an injunction for misuse of intellectual property or for unauthorized access.
      </Text>
      <Text style={styles.body}>
        You agree that we may send notices to the email on your account, or by a posting in the Service. Notices to us must be sent to support@my-rental-fleet.com and to Diamond CM LLC, 85 W Combs Rd, Ste 101, PMB 251, San Tan Valley, AZ 85140.
      </Text>

      <Text style={styles.heading}>21. Other terms</Text>
      <Text style={styles.body}>
        If a court holds part of these terms unenforceable, the rest stays in effect. A delay in enforcing a term is not a waiver. These terms are the whole agreement about the Service and replace earlier oral statements about the same subject. You may not assign these terms without our consent. We may assign them to a successor of the business. There are no third-party beneficiaries.
      </Text>

      <Text style={styles.heading}>22. Contact</Text>
      <Text style={styles.body}>Diamond CM LLC</Text>
      <Text style={styles.body}>85 W Combs Rd, Ste 101, PMB 251</Text>
      <Text style={styles.body}>San Tan Valley, AZ 85140</Text>
      <Text style={styles.body}>support@my-rental-fleet.com</Text>
      <Pressable onPress={() => router.push('/privacy')}>
        <Text style={styles.link}>Privacy policy</Text>
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
