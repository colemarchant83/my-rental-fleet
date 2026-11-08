import { useState, type ComponentType } from 'react';
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export function ZoomModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  if (!uri) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent>
      <View style={styles.backdrop}>
        {Platform.OS === 'web' ? (
          <WebZoom uri={uri} zoomed={zoomed} onToggle={() => setZoomed((value) => !value)} />
        ) : (
          <ScrollView
            style={styles.zoomScroll}
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            contentContainerStyle={styles.zoomContent}
          >
            <Pressable onPress={() => setZoomed((value) => !value)}>
              <Image source={{ uri }} style={zoomed ? styles.imageZoomed : styles.image} resizeMode="contain" />
            </Pressable>
          </ScrollView>
        )}
        <Text style={styles.hint}>{Platform.OS === 'web' ? 'Double-tap the photo to zoom' : 'Pinch or double-tap to zoom'}</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function WebZoom({ uri, zoomed, onToggle }: { uri: string; zoomed: boolean; onToggle: () => void }) {
  const Img = 'img' as unknown as ComponentType<{ src: string; alt: string; style: object; onDoubleClick: () => void }>;
  return (
    <View style={styles.webFrame}>
      <Img
        src={uri}
        alt="Inspection photo"
        onDoubleClick={onToggle}
        style={{ width: zoomed ? '180%' : '100%', height: '100%', objectFit: 'contain' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,16,12,0.94)', justifyContent: 'center' },
  zoomScroll: { flex: 1 },
  zoomContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  image: { width: 360, height: 480 },
  imageZoomed: { width: 900, height: 1200 },
  webFrame: { flex: 1, overflow: 'scroll', alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#e7e1d6', textAlign: 'center', marginBottom: 12 },
  close: {
    alignSelf: 'center',
    backgroundColor: theme.card,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 28,
  },
  closeText: { color: theme.text, fontWeight: '700' },
});
