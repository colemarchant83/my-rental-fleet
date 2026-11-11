import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { loadCachedVehicles, type CachedVehicle } from '../fleet-store';
import { theme } from '../theme';

export default function MaintenanceRecordScreen() {
  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const vehicleId = Array.isArray(params.vehicleId) ? params.vehicleId[0] : params.vehicleId;
  const [vehicle, setVehicle] = useState<CachedVehicle | null>(null);

  useEffect(() => {
    void loadCachedVehicles().then((vehicles) => {
      setVehicle(vehicles.find((item) => item.id === vehicleId) ?? null);
    });
  }, [vehicleId]);

  const name = vehicle?.nickname || vehicle?.yearMakeModel || 'This machine';

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Maintenance record</Text>
      <Text style={styles.name}>{name}</Text>
      {vehicle?.yearMakeModel && vehicle.nickname ? <Text style={styles.muted}>{vehicle.yearMakeModel}</Text> : null}
      <Text style={styles.body}>The record form is next. This is the machine it will be saved under.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
  heading: { fontSize: 32, fontWeight: '800', color: theme.text },
  name: { color: theme.accent, fontWeight: '800', fontSize: 18, marginTop: 16 },
  muted: { color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  body: { color: theme.muted, marginTop: 12, fontSize: 16, lineHeight: 22 },
});
