import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>EV CHARGING INTELLIGENCE</Text>
        <Text style={styles.title}>Grow EV</Text>
        <Text style={styles.description}>
          Smarter charging decisions for drivers and cities.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B1F1A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  eyebrow: {
    color: '#66E3B4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  description: {
    color: '#C7D8D1',
    fontSize: 20,
    lineHeight: 30,
    marginTop: 12,
    maxWidth: 440,
  },
});
