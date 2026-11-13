import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { signOutAccount } from '../account';
import { theme } from '../theme';

export function BrandMenu() {
  const anchor = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState({ x: 16, y: 64 });

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

  return (
    <View ref={anchor} collapsable={false}>
      <Pressable onPress={toggle} hitSlop={8} accessibilityRole="button">
        <Text style={styles.brand}>My Rental Fleet</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: spot.y, left: spot.x }]}>
            <Pressable
              style={styles.item}
              onPress={() => {
                setOpen(false);
                void signOutAccount();
              }}
            >
              <Text style={styles.itemText}>Sign out</Text>
            </Pressable>
          </View>
        </Pressable>
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
    minWidth: 160,
    paddingVertical: 4,
    shadowColor: '#1c1917',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: { paddingHorizontal: 16, paddingVertical: 12 },
  itemText: { color: theme.text, fontWeight: '800', fontSize: 16 },
});
