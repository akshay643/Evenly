// src/navigation/AppNavigator.js
import React, { useContext } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';

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
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['bottom']}>
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
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 1,
            borderTopColor: '#E5E7EB',
            paddingBottom: Platform.OS === 'ios' ? 0 : 8,
            paddingTop: 8,
            height: Platform.OS === 'ios' ? 85 : 65,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.06,
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

  // ── Auth still loading ──
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>

      {/* ═══════════════════════════════════════════ */}
      {/* STEP 1: Onboarding (first launch only)     */}
      {/* ═══════════════════════════════════════════ */}
      {!onboardingDone ? (
        <Stack.Screen name="Onboarding">
          {(props) => (
            <OnboardingScreen {...props} onComplete={completeOnboarding} />
          )}
        </Stack.Screen>
      ) : !user ? (
        /* ═══════════════════════════════════════════ */
        /* STEP 2: Auth (not signed in)               */
        /* ═══════════════════════════════════════════ */
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ animationTypeForReplace: 'pop' }}
        />
      ) : (
        /* ═══════════════════════════════════════════ */
        /* STEP 3: Authenticated app                  */
        /* ═══════════════════════════════════════════ */
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Friends"
            component={FriendsScreen}
            options={{ headerShown: false }}
          />
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
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
});