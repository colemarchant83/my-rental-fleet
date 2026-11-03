import { View, Text, StyleSheet } from 'react-native';



export default function MaintenanceScreen() {

  return (

    <View style={styles.container}>

      <Text style={styles.title}>Maintenance Log</Text>

      <Text style={styles.subtitle}>Coming soon</Text>

    </View>

  );

}



const styles = StyleSheet.create({

  container: {

    flex: 1,

    backgroundColor: '#111827',

    justifyContent: 'center',

    alignItems: 'center',

  },

  title: {

    fontSize: 28,

    fontWeight: 'bold',

    color: '#fff',

  },

  subtitle: {

    fontSize: 16,

    color: '#9ca3af',

    marginTop: 8,

  },

});