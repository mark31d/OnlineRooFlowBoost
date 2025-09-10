// Components/PillTabBar.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Animated, Image, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BR = {
  // фон «пилюли» — глубокий синий
  barGrad1: '#0F224C',
  barGrad2: '#0C1A3B',
  text:     '#FFFFFF',
  dim:      'rgba(234,242,255,0.55)',
  // индикатор — синие акценты как в теме
  acc1:     '#2C8BFF',
  acc2:     '#1E74E8',
};

const ICONS = {
  Calendar: require('../assets/calendar.webp'),
  Stats:    require('../assets/stats.webp'),
  Gallery:  require('../assets/gallery.webp'),
  Articles: require('../assets/articles.webp'),
  Settings: require('../assets/settings.webp'),
};

export default function PillTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [barW, setBarW] = useState(0);

  const PADDING_H = 12;
  const ITEM_GAP  = 0;

  const itemW = barW
    ? (barW - PADDING_H * 2 - ITEM_GAP * (state.routes.length - 1)) / state.routes.length
    : 0;

  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(x, { toValue: state.index, duration: 220, useNativeDriver: true }).start();
  }, [state.index, x]);

  const IND_W = Math.min(64, Math.max(56, Math.round(itemW * 0.82)));
  const IND_H = 56;
  const baseLeft = PADDING_H + (itemW - IND_W) / 2;
  const translateX = Animated.multiply(x, itemW);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Math.max(12, insets.bottom + 4),
        },
        bar: {
          height: 72,
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.08)',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.25,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: 6 },
          }),
        },
        row: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: PADDING_H,
          columnGap: ITEM_GAP,
        },
        indicatorWrap: {
          position: 'absolute',
          top: (72 - IND_H) / 2,
          left: baseLeft,
          width: IND_W,
          height: IND_H,
          borderRadius: 18,
          ...Platform.select({
            ios: {
              shadowColor: BR.acc1,
              shadowOpacity: 0.35,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
            },
            android: { elevation: 8 },
          }),
        },
        indicator: {
          flex: 1,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: 'rgba(44,139,255,0.45)',
        },
        item: {
          width: itemW,
          height: 72,
          alignItems: 'center',
          justifyContent: 'center',
        },
        icon: { width: 24, height: 24 },
      }),
    [insets.bottom, itemW]
  );

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
      pointerEvents="box-none"
    >
      {/* фон пилюли */}
      <LinearGradient
        colors={[BR.barGrad1, BR.barGrad2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bar}
      >
        {/* индикатор активной вкладки */}
        {itemW > 0 && (
          <Animated.View
            style={[styles.indicatorWrap, { transform: [{ translateX }] }]}
            pointerEvents="none"
          >
            <LinearGradient
              colors={[BR.acc1, BR.acc2]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.indicator}
            />
          </Animated.View>
        )}

        <View style={styles.row}>
          {state.routes.map((route, idx) => {
            const { options } = descriptors[route.key];
            const label = options.tabBarLabel ?? options.title ?? route.name;
            const focused = state.index === idx;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            const onLongPress = () =>
              navigation.emit({ type: 'tabLongPress', target: route.key });

            const src = ICONS[label] || ICONS[route.name] || ICONS.Calendar;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarTestID}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.item}
              >
                <Image
                  source={src}
                  resizeMode="contain"
                  style={[
                    styles.icon,
                    { tintColor: focused ? BR.text : BR.dim },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </LinearGradient>
    </View>
  );
}
