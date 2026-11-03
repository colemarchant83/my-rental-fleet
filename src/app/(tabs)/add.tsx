 import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { useState } from 'react';

import { useRouter } from 'expo-router';



export default function AddScreen() {

  const router = useRouter();

  const [nickname, setNickname] = useState('');

  const [vin, setVin] = useState('');



  const saveVehicle = () => {

    if (!nickname || !vin) {

      alert('Please enter a nickname and VIN');

      return;

    }

    alert(`Vehicle saved:\n${nickname}\nVIN: ${vin}`);

    router.back();

  };



  return (

    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <Text style={styles.title}>Add Vehicle</Text>



      <Text style={styles.label}>Nickname</Text>

      <TextInput

        style={styles.input}

        placeholder="e.g. DAD'S 2004 DODGE 3500"

        placeholderTextColor="#6b7280"

        value={nickname}

        onChangeText={setNickname}

      />



      <Text style={styles.label}>VIN</Text>

      <TextInput

        style={styles.input}

        placeholder="Enter VIN"

        placeholderTextColor="#6b7280"

        value={vin}

        onChangeText={setVin}

        autoCapitalize="characters"

      />



      <TouchableOpacity style={styles.saveButton} onPress={saveVehicle}>

        <Text style={styles.saveButtonText}>Save Vehicle</Text>

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

    fontSize: 28,

    fontWeight: 'bold',

    color: '#fff',

    marginBottom: 24,

  },

  label: {

    fontSize: 16,

    color: '#e5e7eb',

    marginBottom: 6,

    marginTop: 12,

  },

  input: {

    backgroundColor: '#374151',

    color: '#fff',

    padding: 14,

    borderRadius: 10,

    fontSize: 16,

  },

  saveButton: {

    backgroundColor: '#f59e0b',

    padding: 16,

    borderRadius: 12,

    alignItems: 'center',

    marginTop: 30,

  },

  saveButtonText: {

    color: '#111827',

    fontSize: 18,

    fontWeight: 'bold',

  },

});