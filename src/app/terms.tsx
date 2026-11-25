import { Linking, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

export default function Terms() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Terms</Text>
      <Text style={styles.updated}>Updated November 24, 2026</Text>
      <Text style={styles.body}>
        My Rental Fleet keeps a record of a rental yard's machines and the condition they go out and come back in. Using the app means you agree to these rules.
      </Text>

      <Text style={styles.heading}>The plans</Text>
      <Text style={styles.body}>$29.99 a month covers a yard with up to 5 machines.</Text>
      <Text style={styles.body}>$49.99 a month covers a yard with up to 10 machines.</Text>
      <Text style={styles.body}>$99.99 a month covers a yard with up to 30 machines.</Text>
      <Text style={styles.body}>
        Payment is handled by the App Store or Google Play. My Rental Fleet does not take the card number. Canceling is done in the phone's subscription settings. Deleting the account does not cancel the payment.
      </Text>

      <Text style={styles.heading}>What you are paying for</Text>
      <Text style={styles.body}>
        The app stores the inspection photos, videos, and rental cards for that yard. It is a record. It is not insurance, and it does not decide a damage claim.
      </Text>
      <Text style={styles.body}>
        The yard is responsible for what it writes down, including the renter's name and the photos. The record should be of that yard's own machines.
      </Text>

      <Text style={styles.heading}>How long a card lasts</Text>
      <Text style={styles.body}>
        A rental card, its photos, and its videos are deleted one year after the rental. Save a card to your own files if you need to keep it. A saved copy is yours, and the app does not delete that copy.
      </Text>

      <Text style={styles.heading}>The account</Text>
      <Text style={styles.body}>
        One yard uses one account. Do not share the sign-in with another company. An account that is not being used to keep rental records can be closed.
      </Text>
      <Text style={styles.body}>Questions can be sent to support@my-rental-fleet.com.</Text>
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
