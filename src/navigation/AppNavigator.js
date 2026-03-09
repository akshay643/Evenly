// src/navigation/AppNavigator.js
import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// Screens
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import GroupScreen from '../screens/GroupScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';
import EditExpenseScreen from '../screens/EditExpenseScreen';
import SettleUpScreen from '../screens/SettleUpScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ActivityScreen from '../screens/ActivityScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import PremiumScreen from '../screens/PremiumScreen';
import FriendsScreen from '../screens/FriendsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// ──────────────────────────────────
// Bottom Tab Navigator
// ──────────────────────────────────
function MainTabs() {
  const { isDark, colors } = useTheme();

  return (
    <SafeAreaView 
      style={{ flex: 1, backgroundColor: colors.surface }}
      edges={['bottom']}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused, color }) => {
            const icons = {
              Dashboard: focused ? 'home' : 'home-outline',
              Activity: focused ? 'pulse' : 'pulse-outline',
              Analytics: focused ? 'bar-chart' : 'bar-chart-outline',
              Profile: focused ? 'person' : 'person-outline',
            };
            return <Ionicons name={icons[route.name]} size={22} color={color} />;
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingBottom: Platform.OS === 'ios' ? 0 : 8,
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 85 : 65,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: isDark ? 0.3 : 0.06,
            shadowRadius: 4,
            elevation: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
          },
        })}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{ tabBarLabel: 'Groups' }}
        />
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ tabBarLabel: 'Activity' }}
        />
        <Tab.Screen
          name="Analytics"
          component={AnalyticsScreen}
          options={{ tabBarLabel: 'Analytics' }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarLabel: 'Profile' }}
        />
      </Tab.Navigator>
    </SafeAreaView>
  );
}

// ──────────────────────────────────
// Root Stack Navigator
// ──────────────────────────────────
export default function AppNavigator({ onboardingDone, completeOnboarding }) {
  const { user, loading } = useContext(AuthContext);
  const { isDark, colors } = useTheme();

  // Auth loading state
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboardingDone ? (
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen {...props} onComplete={completeOnboarding} />
          )}
        </Stack.Screen>
      ) : !user ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ animationTypeForReplace: 'pop' }}
        />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Friends" component={FriendsScreen} />
          <Stack.Screen name="Group" component={GroupScreen} />
          <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
          <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
          <Stack.Screen name="SettleUp" component={SettleUpScreen} />
          <Stack.Screen name="Premium" component={PremiumScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '500',
  },
});