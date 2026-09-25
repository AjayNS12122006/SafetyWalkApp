import { Tabs } from "expo-router";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { View, StyleSheet } from "react-native";
import { Colors } from "../../lib/theme";

function Icon({ name, color, size = 24 }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgAlt,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Icon name="index" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="contacts"
        options={{
          title: "Contacts",
          tabBarIcon: ({ color, size }) => (
            <Icon name="people" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="walk"
        options={{
          title: "Walk",
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.circle,
                focused && styles.active,
              ]}
            >
              <MaterialCommunityIcons
                name="walk"
                size={22}
                color={Colors.bg}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Icon name="time" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Icon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  active: {
    shadowColor: Colors.accent,
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
  },
});