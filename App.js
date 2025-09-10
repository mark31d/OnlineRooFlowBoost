
import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // ⬅️ ВАЖНО

import Loader            from './Components/Loader';
import Onboarding        from './Components/Onboarding';
import CalendarScreen    from './Components/CalendarScreen';
import StatsScreen       from './Components/StatsScreen';
import GalleryScreen     from './Components/GalleryScreen';
import ArticlesScreen    from './Components/ArticlesScreen';
import SettingsScreen    from './Components/SettingsScreen';

import TrainingLogForm   from './Components/TrainingLogForm';
import TimerModal        from './Components/TimerModal';

import PillTabBar from './Components/PillTabBar';

const RootStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export const BR = {
  bg: '#0A0540', panel:'#1A1450', text:'#FFFFFF', subtext:'rgba(255,255,255,0.72)',
  outline:'#6D63FF', gold1:'#FFB400', gold2:'#FF6A00', border:'rgba(255,255,255,0.08)',
};

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: BR.bg, card: BR.bg, text: BR.text, border: BR.border, primary: BR.gold1,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      initialRouteName="Calendar"
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
      tabBar={(props) => <PillTabBar {...props} />}
    >
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Stats"    component={StatsScreen} />
      <Tab.Screen name="Gallery"  component={GalleryScreen} />
      <Tab.Screen name="Articles" component={ArticlesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [boot, setBoot] = useState({ ready: false, seenOnboarding: false });

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('br:seenOnboarding');
        setTimeout(() => setBoot({ ready: true, seenOnboarding: !!seen }), 900);
      } catch {
        setBoot({ ready: true, seenOnboarding: false });
      }
    })();
  }, []);

  if (!boot.ready) return <Loader />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}> {/* ⬅️ Обёртка для всех жестов */}
      <SafeAreaProvider>
        <StatusBar translucent barStyle="light-content" backgroundColor="transparent" />
        <NavigationContainer theme={theme}>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            {!boot.seenOnboarding && (
              <RootStack.Screen name="Onboarding" component={Onboarding} />
            )}

            <RootStack.Screen name="Tabs" component={Tabs} />

            <RootStack.Screen
              name="TrainingLog"
              component={TrainingLogForm}
              options={{ presentation: 'card', animation: 'slide_from_right' }}
            />

            <RootStack.Group screenOptions={{ presentation: 'modal', headerShown: false }}>
              <RootStack.Screen name="Timer" component={TimerModal} />
            </RootStack.Group>
          </RootStack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
