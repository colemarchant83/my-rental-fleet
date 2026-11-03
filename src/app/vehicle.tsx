import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';



export default function VehicleDetailScreen() {

  const { id, nickname, yearMakeModel, specs, vin, status } = useLocalSearchParams();



  return (

    <View style={styles.container}>

      <Text style={styles.nickname}>{nickname}</Text>

      <Text style={styles.yearMakeModel}>{yearMakeModel}</Text>

      <Text style={styles.specs}>{specs}</Text>

      <Text style={styles.vin}>VIN {vin}</Text>

      <View style={styles.statusBadge}>

        <Text style={styles.statusText}>{status}</Text>

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: '#111827',

    padding: 20,

  },

  nickname: {

    fontSize: 18,

    fontWeight: 'bold',

    color: '#f59e0b',

  },

  yearMakeModel: {

    fontSize: 28,

    fontWeight: 'bold',

    color: '#fff',

    marginTop: 8,

  },

  specs: {

    fontSize: 16,

    color: '#9ca3af',

    marginTop: 4,

  },

  vin: {

    fontSize: 14,

    color: '#6b7280',

    marginTop: 8,

  },

  statusBadge: {

    backgroundColor: '#10b981',

    alignSelf: 'flex-start',

    paddingHorizontal: 12,

    paddingVertical: 6,

    borderRadius: 12,

    marginTop: 16,

  },

  statusText: {

    color: '#fff',

    fontWeight: '600',

  },

});