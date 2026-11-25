import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

export default function Privacy() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy</Text>
      <Text style={styles.updated}>Updated November 24, 2026</Text>
      <Text style={styles.body}>
        My Rental Fleet is a record of the machines a rental yard sends out and the condition they come back in. This page says what the app keeps and what it does with it.
      </Text>

      <Text style={styles.heading}>What the app stores</Text>
      <Text style={styles.body}>The account email and password, so the yard can sign in.</Text>
      <Text style={styles.body}>The machines in that yard, including the nickname, the VIN, and the photo of the machine.</Text>
      <Text style={styles.body}>
        Each rental card: the renter's name, the out and back dates, fuel, miles or hours, notes, and the inspection photos and videos.
      </Text>
      <Text style={styles.body}>Maintenance notes and photos, if the yard writes them down.</Text>
      <Text style={styles.body}>A short problem report, if the app hits an error. That report goes to our support email.</Text>

      <Text style={styles.heading}>Who can see it</Text>
      <Text style={styles.body}>A yard can see only its own machines and rental cards. Another company using the app cannot open them.</Text>
      <Text style={styles.body}>
        The yard can email a link to one card. Anyone who has that link can open that one card. The link does not open the rest of the yard.
      </Text>
      <Text style={styles.body}>We do not sell this information, and we do not use it for advertising.</Text>
      <Text style={styles.body}>
        Google Firebase stores the account and the rental records. Cloudflare stores the photos and videos. Those companies hold the files so the app can open them. They do not get permission to use the records for their own purposes.
      </Text>
      <Text style={styles.body}>
        If a yard pays through the App Store, Apple handles the payment. My Rental Fleet does not receive the card number.
      </Text>

      <Text style={styles.heading}>How long it is kept</Text>
      <Text style={styles.body}>
        A rental card, its photos, and its videos are deleted one year after the rental. A copy saved to the yard's own files is not deleted by the app. That copy stays wherever the yard saved it.
      </Text>
      <Text style={styles.body}>
        Deleting one rental removes that card and the photos and videos stored with it. Deleting the account removes the yard's machines, rental cards, photos, videos, and the sign-in.
      </Text>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>
        Questions about an account or a request to look at or delete records can be sent to support@my-rental-fleet.com.
      </Text>
      <Pressable onPress={() => void Linking.openURL('mailto:support@my-rental-fleet.com')}>
        <Text style={styles.link}>Email support</Text>
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
  link: { color: theme.accent, fontSize: 16, fontWeight: '800', marginTop: 12 },
});
