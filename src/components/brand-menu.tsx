import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { signOutAccount } from '../account';
import { isOperator } from '../problem-report';
import { deleteAccount } from '../delete-account';
import { theme } from '../theme';

export function BrandMenu() {
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState({ x: 16, y: 64 });
  const [warn, setWarn] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    const show = (x: number, y: number, height: number) => {
      setSpot({ x: Math.max(12, x), y: y + height + 6 });
      setOpen(true);
    };
    const node = anchor.current;
    if (node && typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, _width, height) => show(x, y, height));
      return;
    }
    show(16, 52, 24);
  };

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await deleteAccount();
      setConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the account.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <View ref={anchor} collapsable={false}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button">
        <Text style={styles.brand}>My Rental Fleet</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: spot.y, left: spot.x }]}>
            {isOperator() ? (
              <Pressable
                style={styles.item}
                onPress={() => {
                  setOpen(false);
                  router.push('/problems');
                }}
              >
                <Text style={styles.itemText}>Problem reports</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.item}
              onPress={() => {
                setOpen(false);
                void signOutAccount();
              }}
            >
              <Text style={styles.itemText}>Sign out</Text>
            </Pressable>
            <Pressable
              style={styles.item}
              onPress={() => {
                setOpen(false);
                setError('');
                setWarn(true);
              }}
            >
              <Text style={styles.deleteItem}>Delete account</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={warn && !confirm} transparent animationType="fade" onRequestClose={() => setWarn(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete this account?</Text>
            <Text style={styles.help}>
              Deleting will erase all machines, rental cards, maintenance records, photos, and video. Any necessary files should be saved to files on the phone or computer before deleting. Deleting this account <Text style={styles.bold}>does not</Text> cancel your subscription. If you wish to cancel, you must do so through your phone settings or the app stores.
            </Text>
            <Pressable
              style={styles.deleteWide}
              onPress={() => {
                setWarn(false);
                setConfirm(true);
              }}
            >
              <Text style={styles.deleteText}>Continue</Text>
            </Pressable>
            <Pressable style={styles.cancel} onPress={() => setWarn(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => { if (!deleting) setConfirm(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm delete</Text>
            <Text style={styles.help}>
              This permanently deletes the account and everything stored with it. The same email can be used again later, but it will be a new empty account. Deleting this account <Text style={styles.bold}>does not</Text> cancel your subscription. If you wish to cancel, you must do so through your phone settings or the app stores.
            </Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={styles.deleteWide} disabled={deleting} onPress={() => void remove()}>
              {deleting ? <ActivityIndicator color={theme.white} /> : <Text style={styles.deleteText}>Confirm delete</Text>}
            </Pressable>
            <Pressable style={styles.cancel} disabled={deleting} onPress={() => setConfirm(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { color: theme.text, fontSize: 20, fontWeight: '700' },
  backdrop: { flex: 1 },
  menu: {
    position: 'absolute',
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    minWidth: 180,
    paddingVertical: 4,
    shadowColor: '#1c1917',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { paddingHorizontal: 16, paddingVertical: 12 },
  itemText: { color: theme.text, fontWeight: '800', fontSize: 16 },
  deleteItem: { color: theme.danger, fontWeight: '800', fontSize: 16 },
  help: { color: theme.muted, marginTop: 8, lineHeight: 20 },
  bold: { fontWeight: '800', color: theme.text },
  error: { color: theme.danger, marginTop: 12, lineHeight: 20 },
  deleteWide: { marginTop: 16, backgroundColor: theme.danger, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteText: { color: theme.white, fontWeight: '800' },
  cancel: { marginTop: 8, paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: theme.text, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,25,23,0.45)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: theme.card, borderRadius: 16, padding: 18 },
  modalTitle: { fontWeight: '800', color: theme.text, fontSize: 20 },
});
