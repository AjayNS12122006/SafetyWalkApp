import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
<<<<<<< HEAD
import "../lib/webAlert";
=======
>>>>>>> 9b07a957918647ad28e0a11653ad6aff9c75e78f

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sos" options={{ presentation: 'fullScreenModal' }} />
      </Stack>

      <StatusBar style="light" />
    </ThemeProvider>
  );
}