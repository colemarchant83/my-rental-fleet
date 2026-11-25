import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { currentOwnerId } from '../account';
import { PLAN_SIZES, machineOnPlan, savePlanChoices, savePlanLimit, useReactivationCredits, watchPlanAccount } from '../plan';
import { theme } from '../theme';

type Machine = { id: string; nickname?: string; yearMakeModel?: string; onPlan?: boolean; status?: string; planLock?: number };

export default function PlanScreen() {
  const [limit, setLimit] = useState<number | null>(null);
  const [credits, setCredits] = useState(0);
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
    const stop = watchPlanAccount((plan) => {
      setLimit(plan.limit);
      setCredits(plan.credits);
    });
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
        await savePlanLimit(null);
        setSaved('No limit. A deactivated machine still stays off until you move to a larger plan or delete an active machine.');
      } else {
        await savePlanLimit(next);
        const onNow = machines.filter((item) => machineOnPlan(item)).length;
        setSaved(onNow > next
          ? `This test plan covers ${next} machines. Uncheck the ones to deactivate, then tap Deactivate these machines. They stay off until you delete an active machine or move to a larger plan.`
          : `This test plan covers ${next} machines. A machine that was deactivated stays off unless this plan is larger than the one that parked it, or you deleted an active machine.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the plan');
    } finally {
      setBusy('');
    }
  };

  const lockedWithoutCredit = (item: Machine) => {
    if (!item.planLock || machineOnPlan(item)) return false;
    if (limit != null && limit > item.planLock) return false;
    return true;
  };

  const toggle = (id: string) => {
    setSaved('');
    setError('');
    const item = machines.find((machine) => machine.id === id);
    if (!item) return;
    if (picked.includes(id)) {
      setPicked((current) => current.filter((machineId) => machineId !== id));
      return;
    }
    const needsCredit = lockedWithoutCredit(item);
    const used = machines.filter((machine) => picked.includes(machine.id) && lockedWithoutCredit(machine) && !machineOnPlan(machine)).length;
    if (needsCredit && used >= credits) {
      setError('This machine stays off until you delete an active machine or move to a larger plan.');
      return;
    }
    if (limit && picked.length >= limit) {
      setError('Deactivating a machine does not open a spot. Delete an active machine or move to a larger plan.');
      return;
    }
    setPicked((current) => [...current, id]);
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
      const changes: { id: string; onPlan: boolean; planLock?: number | null }[] = [];
      let used = 0;
      for (const item of machines) {
        const on = picked.includes(item.id);
        const wasOn = machineOnPlan(item);
        if (on === wasOn) continue;
        if (!on) {
          changes.push({ id: item.id, onPlan: false, planLock: limit ?? item.planLock ?? 30 });
          continue;
        }
        const unlockedByPlan = item.planLock != null && limit != null && limit > item.planLock;
        if (item.planLock != null && !unlockedByPlan) used += 1;
        changes.push({ id: item.id, onPlan: true, planLock: null });
      }
      if (used > credits) {
        setError('This machine stays off until you delete an active machine or move to a larger plan.');
        return;
      }
      await savePlanChoices(changes);
      if (used) await useReactivationCredits(used);
      await loadMachines();
      if (!changes.length) {
        setSaved('No change.');
        return;
      }
      const turningOff = changes.some((item) => !item.onPlan);
      const turningOn = changes.some((item) => item.onPlan);
      setSaved(turningOn && turningOff
        ? 'Updated. Deactivated machines stay off. They do not open a spot for another machine.'
        : turningOn
          ? 'Reactivated. That used an open spot from a larger plan, or from deleting an active machine.'
          : 'Deactivated. Those machines stay off until you delete an active machine or move to a larger plan. Their cards stay.');
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
      <Text style={styles.body}>{limit ? `${onCount} of ${limit} selected. Uncheck a machine to deactivate it. It stays off, and it does not open a spot, until you delete an active machine or move to a larger plan.` : 'A deactivated machine stays off. Moving to a larger plan, or deleting an active machine, is what lets it come back.'}</Text>
      {machines.map((item) => {
        const on = picked.includes(item.id);
        return (
          <Pressable key={item.id} style={[styles.machine, on && styles.machineOn]} disabled={!!busy} onPress={() => toggle(item.id)}>
            <Text style={styles.machineName}>{item.nickname || item.yearMakeModel || 'Untitled'}</Text>
            <Text style={styles.machineState}>{on ? 'On the plan' : item.planLock ? 'Stays off' : 'Off the plan'}</Text>
          </Pressable>
        );
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}
      <Pressable style={styles.save} disabled={!!busy} onPress={() => void saveChoices()}>
        {busy === 'save' ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.saveText}>{machines.some((item) => machineOnPlan(item) && !picked.includes(item.id)) ? 'Deactivate these machines' : 'Reactivate these machines'}</Text>}
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
