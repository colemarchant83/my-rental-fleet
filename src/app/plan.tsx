import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { currentOwnerId } from '../account';
import { PLAN_SIZES, machineOnPlan, savePlanChoices, savePlanLimit, watchPlanLimit } from '../plan';
import { theme } from '../theme';

type Machine = { id: string; nickname?: string; yearMakeModel?: string; onPlan?: boolean; status?: string };

export default function PlanScreen() {
  const [limit, setLimit] = useState<number | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  const loadMachines = async () => {
    const snap = await getDocs(query(collection(db, 'vehicles'), where('ownerId', '==', currentOwnerId())));
    const next = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as Machine);
    setMachines(next);
    setPicked(next.filter((item) => machineOnPlan(item)).map((item) => item.id));
  };

  useEffect(() => {
    const stop = watchPlanLimit(setLimit);
    void loadMachines().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load machines'));
    return stop;
  }, []);

  const onCount = machines.filter((item) => picked.includes(item.id)).length;

  const chooseLimit = async (next: number | null) => {
    setError('');
    setSaved('');
    setBusy('limit');
    try {
      if (next === null) {
        await savePlanChoices(machines.map((item) => ({ id: item.id, onPlan: true })));
        await savePlanLimit(null);
        setPicked(machines.map((item) => item.id));
        setSaved('No limit. Every machine is back on the plan. Nothing was deleted.');
      } else {
        await savePlanLimit(next);
        setSaved(machines.filter((item) => machineOnPlan(item)).length > next
          ? `This test plan covers ${next} machines. Uncheck the ones that should come off. Their cards stay.`
          : `This test plan covers ${next} machines.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan');
    } finally {
      setBusy('');
    }
  };

  const toggle = (id: string) => {
    setSaved('');
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (limit && current.length >= limit) return current;
      return [...current, id];
    });
  };

  const saveChoices = async () => {
    if (limit && picked.length > limit) {
      setError(`Pick no more than ${limit}.`);
      return;
    }
    setBusy('save');
    setError('');
    setSaved('');
    try {
      await savePlanChoices(machines.map((item) => ({ id: item.id, onPlan: picked.includes(item.id) })));
      setSaved('Saved. Machines that are off the plan cannot start a new rental. A machine that is already out can still be checked in. Old cards stay.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save those machines');
    } finally {
      setBusy('');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Plan test</Text>
      <Text style={styles.body}>Billing is not on. These buttons do not charge anyone. They only test what happens when a yard drops to a smaller plan.</Text>
      <Text style={styles.current}>{limit ? `Test plan: up to ${limit} machines` : 'Test plan: no limit'}</Text>
      <View style={styles.row}>
        {PLAN_SIZES.map((size) => (
          <Pressable key={size} style={[styles.choice, limit === size && styles.choiceOn]} disabled={!!busy} onPress={() => void chooseLimit(size)}>
            <Text style={styles.choiceText}>Up to {size}</Text>
          </Pressable>
        ))}
        <Pressable style={[styles.choice, !limit && styles.choiceOn]} disabled={!!busy} onPress={() => void chooseLimit(null)}>
          <Text style={styles.choiceText}>No limit</Text>
        </Pressable>
      </View>
      <Text style={styles.heading}>Machines on this plan</Text>
      <Text style={styles.body}>{limit ? `${onCount} of ${limit} selected. Uncheck a machine to take it off. Its rental cards are not deleted.` : 'With no limit, every machine can start a rental.'}</Text>
      {machines.map((item) => {
        const on = picked.includes(item.id);
        const blocked = !!limit && !on && picked.length >= limit;
        return (
          <Pressable key={item.id} style={[styles.machine, on && styles.machineOn]} disabled={blocked || !!busy} onPress={() => toggle(item.id)}>
            <Text style={styles.machineName}>{item.nickname || item.yearMakeModel || 'Untitled'}</Text>
            <Text style={styles.machineState}>{on ? 'On the plan' : 'Off the plan'}</Text>
          </Pressable>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}
      <Pressable style={styles.save} disabled={!!busy} onPress={() => void saveChoices()}>
        {busy === 'save' ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.saveText}>Save these machines</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: 22, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: theme.text, fontSize: 32, fontWeight: '800' },
  current: { color: theme.text, fontWeight: '800', marginTop: 16 },
  heading: { color: theme.text, fontSize: 20, fontWeight: '800', marginTop: 22 },
  body: { color: theme.muted, fontSize: 16, lineHeight: 22, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  choice: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  choiceOn: { borderColor: theme.accent, borderWidth: 2 },
  choiceText: { color: theme.text, fontWeight: '800' },
  machine: { marginTop: 10, backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.line, padding: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  machineOn: { borderColor: theme.green, borderWidth: 2 },
  machineName: { color: theme.text, fontWeight: '800', flex: 1 },
  machineState: { color: theme.muted, fontWeight: '700' },
  error: { color: theme.danger, marginTop: 12 },
  saved: { color: theme.text, marginTop: 12, lineHeight: 20 },
  save: { marginTop: 16, backgroundColor: theme.action, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: theme.ink, fontWeight: '800' },
});
