import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppNavigation } from '../components/AppNavigation';
import { colors } from '../features/map/tokens';

export default function RootLayout() {
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.main }}>
      <AppNavigation />
      <View style={{ flex: 1 }}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.main } }} /></View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}
