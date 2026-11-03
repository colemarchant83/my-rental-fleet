import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActionSheetIOS, Platform, TextInput } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';

const photoAreas = [
  'Front',
  'Driver’s Side',
  'Rear',
  'Passenger Side',
  'Windshield',
  'Interior',
  'Tires & Wheels',
];

export default function InspectionScreen() {
  const params = useLocalSearchParams();
  const nickname = params.nickname as string;
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const addPhoto = async (area: string, fromCamera: boolean) => {
    const permission = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow access.');
      return;
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          quality: 1,
          allowsEditing: false,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
          allowsMultipleSelection: false,
        });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setPhotos((prev) => ({
        ...prev,
        [area]: [...(prev[area] || []), uri],
      }));
    }
  };

  const recordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  };

  const handleAreaPress = (area: string) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) addPhoto(area, true);
          if (buttonIndex === 2) addPhoto(area, false);
        }
      );
    } else {
      Alert.alert(area, 'Add photo', [
        { text: 'Take Photo', onPress: () => addPhoto(area, true) },
        { text: 'Choose from Library', onPress: () => addPhoto(area, false) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Pre-Rental Inspection</Text>
      <Text style={styles.subtitle}>{nickname}</Text>

      <Text style={styles.section}>Photo Areas</Text>
      {photoAreas.map((area) => (
        <View key={area} style={styles.areaContainer}>
          <TouchableOpacity style={styles.areaButton} onPress={() => handleAreaPress(area)}>
            <Text style={styles.areaText}>{area}</Text>
            <Text style={styles.areaHint}>
              {photos[area]?.length ? `${photos[area].length} photo(s)` : 'Tap to add photos'}
            </Text>
          </TouchableOpacity>

          <View style={styles.thumbnailRow}>
            {photos[area]?.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.thumbnail} />
            ))}
          </View>

          <TextInput
            style={styles.notesInput}
            placeholder={`Notes for ${area}...`}
            placeholderTextColor="#6b7280"
            value={notes[area] || ''}
            onChangeText={(text) => setNotes((prev) => ({ ...prev, [area]: text }))}
            multiline
          />
        </View>
      ))}

      <TouchableOpacity style={styles.videoButton} onPress={recordVideo}>
        <Text style={styles.videoButtonText}>
          {videoUri ? 'Video Recorded ✓' : 'Record Before Video'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#f59e0b',
    marginTop: 4,
    marginBottom: 20,
  },
  section: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  areaContainer: {
    marginBottom: 20,
  },
  areaButton: {
    backgroundColor: '#374151',
    padding: 16,
    borderRadius: 10,
  },
  areaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  areaHint: {
    color: '#9ca3af',
    fontSize: 13,
    marginTop: 2,
  },
  thumbnailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#1f2937',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  videoButton: {
    backgroundColor: '#f59e0b',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  videoButtonText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: 'bold',
  },
});