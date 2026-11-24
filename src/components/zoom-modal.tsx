import { createElement, useEffect, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../theme';

export function ZoomModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const [zoomed, setZoomed] = useState(false);
  const { width, height } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  useEffect(() => {
    setZoomed(false);
  }, [uri]);
  if (!uri) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} transparent>
      <GestureHandlerRootView style={styles.backdrop}>
        {Platform.OS === 'web' ? (
          <WebZoom uri={uri} zoomed={zoomed} desktop={desktop} onToggle={() => setZoomed((value) => !value)} />
        ) : (
          <PhoneZoom uri={uri} width={width} height={Math.max(280, height - 160)} />
        )}
        <Text style={styles.hint}>{desktop ? (zoomed ? 'Click the photo to shrink it' : 'Click the photo to zoom') : Platform.OS === 'web' ? 'Double-tap the photo to zoom' : 'Pinch or double-tap to zoom'}</Text>
        <Pressable style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

function PhoneZoom({ uri, width, height }: { uri: string; width: number; height: number }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const pinch = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.min(4, Math.max(1, savedScale.value * event.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        panX.value = withTiming(0);
        panY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value <= 1) return;
      panX.value = savedX.value + event.translationX;
      panY.value = savedY.value + event.translationY;
    })
    .onEnd(() => {
      savedX.value = panX.value;
      savedY.value = panY.value;
    });
  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1.05) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        panX.value = withTiming(0);
        panY.value = withTiming(0);
        savedX.value = 0;
        savedY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }, { scale: scale.value }],
  }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
      <Animated.Image source={{ uri }} resizeMode="contain" style={[{ width, height }, imageStyle]} />
    </GestureDetector>
  );
}

function WebZoom({ uri, zoomed, desktop, onToggle }: { uri: string; zoomed: boolean; desktop: boolean; onToggle: () => void }) {
  return (
    <View style={[styles.webFrame, zoomed ? styles.webFrameZoomed : null]}>
      {createElement('img', {
        src: uri,
        alt: 'Inspection photo',
        onClick: desktop ? onToggle : undefined,
        onDoubleClick: desktop ? undefined : onToggle,
        style: {
          width: zoomed ? '200%' : '100%',
          height: zoomed ? '200%' : '100%',
          objectFit: 'contain',
          cursor: desktop ? (zoomed ? 'zoom-out' : 'zoom-in') : 'default',
        },
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,16,12,0.94)', justifyContent: 'center', alignItems: 'center' },
  webFrame: { flex: 1, overflow: 'auto', alignItems: 'center', justifyContent: 'center' },
  webFrameZoomed: { alignItems: 'flex-start', justifyContent: 'flex-start' },
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
