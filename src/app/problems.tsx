import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { db } from '../firebase';
import { isOperator, reportProblem } from '../problem-report';
import { theme } from '../theme';

type Problem = {
  id: string;
  email: string;
  message: string;
  page: string;
  when: string;
};

function whenLabel(value: unknown) {
  const stamp = value as { toDate?: () => Date } | undefined;
  const date = stamp?.toDate?.();
  if (!date) return '';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function ProblemsScreen() {
  const insets = useSafeAreaInsets();
  const allowed = isOperator();
  const [rows, setRows] = useState<Problem[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    const snap = await getDocs(query(collection(db, 'problems'), orderBy('createdAt', 'desc'), limit(40)));
    setRows(
      snap.docs.map((item) => ({
        id: item.id,
        email: String(item.get('email') || 'Unknown account'),
        message: String(item.get('message') || 'Problem'),
        page: String(item.get('page') || ''),
        when: whenLabel(item.get('createdAt')),
      }))
    );
  }, [allowed]);

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load problem reports.'));
  }, [load]);

  const sendTest = async () => {
    setBusy(true);
    setError('');
    try {
      await reportProblem('Test problem report from the owner account.', 'test');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the test.');
    } finally {
      setBusy(false);
    }
  };

  if (!allowed) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, padding: 20, paddingTop: 24 }}>
        <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>Problem reports</Text>
        <Text style={{ color: theme.muted, marginTop: 8 }}>This page is only on the owner account.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 32 }}>
      <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>Problem reports</Text>
      <Text style={{ color: theme.muted, marginTop: 8, marginBottom: 16, lineHeight: 20 }}>
        These are problems users hit in the app. A short notice also goes to support@my-rental-fleet.com.
      </Text>
      <Pressable onPress={() => void sendTest()} disabled={busy} style={{ backgroundColor: theme.action, borderRadius: 14, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
        {busy ? <ActivityIndicator color={theme.ink} /> : <Text style={{ color: theme.ink, fontWeight: '800' }}>Send a test problem</Text>}
      </Pressable>
      {error ? <Text style={{ color: theme.danger, marginTop: 12 }}>{error}</Text> : null}
      {rows.length === 0 ? <Text style={{ color: theme.muted, marginTop: 18 }}>No problems reported yet.</Text> : null}
      {rows.map((row) => (
        <View key={row.id} style={{ backgroundColor: theme.card, borderRadius: 14, padding: 14, marginTop: 12, borderWidth: 1, borderColor: theme.line }}>
          <Text style={{ color: theme.text, fontWeight: '800' }}>{row.email}</Text>
          <Text style={{ color: theme.muted, marginTop: 2 }}>{[row.when, row.page].filter(Boolean).join(' · ')}</Text>
          <Text style={{ color: theme.text, marginTop: 8, lineHeight: 20 }}>{row.message}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
