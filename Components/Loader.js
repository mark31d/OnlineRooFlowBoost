// Components/Loader.js
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

const BR = {
  bg:   '#0A2351',
  text: '#EAF2FF',
  gold: '#FFC84D',
  chipR:'#E74D3C',
  chipB:'#2EA0F7',
  chipW:'#FFFFFF',
};

const LAYERS = {
  top:    '#0C2E6E',
  middle: '#123D8C',
  bottom: '#08275A',
};

const TITAN = Platform.select({ ios: 'TitanOne', android: 'TitanOne-Regular' }) || undefined;
const LOGO = require('../assets/roo_timer.webp');

function makeBandPath(w, h, opts) {
  const {
    topY, bottomY,
    ampTop = 0, ampBottom = 0,
    phaseTop = 0, phaseBottom = 0,
    mode = 'between', samples = 28,
  } = opts;

  const xs = Array.from({ length: samples }, (_, i) => (w * i) / (samples - 1));
  const yTop = topY == null ? null : xs.map(x => topY + ampTop * Math.sin((x / w) * Math.PI * 2 + phaseTop));
  const yBot = bottomY == null ? null : xs.map(x => bottomY + ampBottom * Math.sin((x / w) * Math.PI * 2 + phaseBottom));

  if (mode === 'between' && yTop && yBot) {
    let d = `M 0 ${yTop[0]}`;
    xs.forEach((x, i) => { d += ` L ${x} ${yTop[i]}`; });
    d += ` L ${w} ${yBot[samples - 1]}`;
    for (let i = samples - 2; i >= 0; i--) d += ` L ${xs[i]} ${yBot[i]}`;
    d += ' Z';
    return d;
  }
  if (mode === 'above' && yBot) {
    let d = `M 0 0 L ${w} 0 L ${w} ${yBot[samples - 1]}`;
    for (let i = samples - 2; i >= 0; i--) d += ` L ${xs[i]} ${yBot[i]}`;
    d += ' Z';
    return d;
  }
  if (mode === 'below' && yTop) {
    let d = `M 0 ${h} L ${w} ${h} L ${w} ${yTop[samples - 1]}`;
    for (let i = samples - 2; i >= 0; i--) d += ` L ${xs[i]} ${yTop[i]}`;
    d += ' Z';
    return d;
  }
  return '';
}

function sparklePath(cx, cy, r = 10) {
  const s = r;
  return `M ${cx - s} ${cy} L ${cx + s} ${cy} M ${cx} ${cy - s} L ${cx} ${cy + s}`;
}

export default function Loader({
  delay = 1400,
  onFinish,
  showLogo = true,
  showTitle = true,
  message,
}) {
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(width, height), [width, height]);

  useEffect(() => {
    if (!onFinish) return;
    const t = setTimeout(onFinish, delay);
    return () => clearTimeout(t);
  }, [onFinish, delay]);

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const logoAnimStyle = {
    transform: [
      { scale:      pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
      { translateY: pulse.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
    ],
  };

  const dots = [useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current,
                useRef(new Animated.Value(0)).current];
  useEffect(() => {
    dots.forEach((v, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
          Animated.delay(140),
        ])
      ).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dotStyle = (v) => ({
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
      { scale:     v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
    ],
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
  });

  const y1 = height * 0.30;
  const y2 = height * 0.60;
  const pathTopFill    = makeBandPath(width, height, { bottomY: y1, ampBottom: 14, phaseBottom: 0.4, mode: 'above' });
  const pathMiddleBand = makeBandPath(width, height, { topY: y1, bottomY: y2, ampTop: 14, ampBottom: 18, phaseTop: 0.4, phaseBottom: 1.4, mode: 'between' });
  const pathBottomFill = makeBandPath(width, height, { topY: y2, ampTop: 18, phaseTop: 1.4, mode: 'below' });

  const s1 = sparklePath(width * 0.70, height * 0.22, 9);
  const s2 = sparklePath(width * 0.18, height * 0.38, 7);

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Path d={pathTopFill}    fill={LAYERS.top} />
        <Path d={pathMiddleBand} fill={LAYERS.middle} />
        <Path d={pathBottomFill} fill={LAYERS.bottom} />
        <Path d={s1} stroke={BR.gold} strokeOpacity={0.75} strokeWidth={2.2} strokeLinecap="round" />
        <Path d={s2} stroke={BR.gold} strokeOpacity={0.55} strokeWidth={2}   strokeLinecap="round" />
      </Svg>

      <View style={styles.center}>
        {showLogo && (
          <Animated.View style={[styles.logoBox, logoAnimStyle]}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>
        )}

        {showTitle && (
          <>
            <Text style={styles.title}>BOOST ROO</Text>
            <Text style={styles.subtitle}>BETTER FLOW</Text>
          </>
        )}

        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>

      <View style={styles.dotsRow}>
        <Animated.View style={[styles.dot, styles.dotR, dotStyle(dots[0])]} />
        <Animated.View style={[styles.dot, styles.dotW, dotStyle(dots[1])]} />
        <Animated.View style={[styles.dot, styles.dotB, dotStyle(dots[2])]} />
      </View>
    </View>
  );
}

function makeStyles(w, h) {
  const min = Math.min(w, h);
  const icon = Math.round(min * 0.34);
  const padTop = Math.round(h * 0.14);

  return StyleSheet.create({
    wrap: {
      flex: 1,
      backgroundColor: BR.bg,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 28,
    },
    center: { marginTop: padTop, alignItems: 'center' },

    logoBox: {
      width: icon,
      height: icon,
      marginBottom: Math.max(16, Math.round(min * 0.03)),
      shadowColor: BR.gold,
      shadowOpacity: 0.35,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    logo: { width: '100%', height: '100%' , borderRadius:25 },

    title: {
      color: BR.gold,
      fontFamily: TITAN, // безопасный фолбэк — см. объявление TITAN
      fontSize: Math.round(min * 0.088),
      letterSpacing: 0.6,
      textAlign: 'center',
      lineHeight: Math.round(min * 0.098),
      textShadowColor: 'rgba(0,0,0,0.45)',
      textShadowOffset: { width: 0, height: 3 },
      textShadowRadius: 8,
    },
    subtitle: {
      color: BR.text,
      fontFamily: TITAN,
      marginTop: 2,
      fontSize: Math.round(min * 0.052),
      letterSpacing: 1.2,
      opacity: 0.9,
      textShadowColor: 'rgba(0,0,0,0.35)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    message: {
      marginTop: 10,
      color: 'rgba(234,242,255,0.92)',
      fontSize: Math.round(min * 0.04),
      textAlign: 'center',
    },

    dotsRow: {
      width: 96,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginHorizontal: 9, // вместо columnGap
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 4,
    },
    dotR: { backgroundColor: BR.chipR },
    dotW: { backgroundColor: BR.chipW },
    dotB: { backgroundColor: BR.chipB },
  });
}
