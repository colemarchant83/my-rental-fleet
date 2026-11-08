import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme';

export default function MaintenanceScreen() {
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Maintenance Log</Text>
      <Text style={styles.body}>Service records are next. Checkout, check-in, and the rental photos come first so a rental can still be finished with a customer waiting.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  heading: { fontSize: 32, fontWeight: '800', color: theme.text },
  body: { color: theme.muted, marginTop: 10, fontSize: 16, lineHeight: 22 },
});
