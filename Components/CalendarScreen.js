// Components/CalendarScreen.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, Image, Dimensions, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Swipeable } from 'react-native-gesture-handler';

const { width: W, height: H } = Dimensions.get('window');

/** Сине-сапфировая палитра */
const BR = {
  bg:    '#0A1433',                     // глубокий тёмно-синий фон
  card:  '#0E1D44',                     // карточки
  text:  '#EAF2FF',                     // светлый текст
  sub:   'rgba(234,242,255,0.78)',      // вторичный текст
  line:  'rgba(255,255,255,0.12)',
  btn1:  '#2C8BFF',                     // градиент сверху
  btn2:  '#1E74E8',                     // градиент снизу
  chip:  '#102A5A',                     // чипы дней
  ring:  '#47C2FF',                     // прогресс-обводка
};

const DATE_INACTIVE = ['#0F224C', '#0C1A3B'];        // неактивные плитки дат
const DATE_ACTIVE   = [BR.btn1, BR.btn2];            // активная дата — акцентный градиент

/** Волновой фон в синих тонах */
const LAYERS = {
  top:    '#0E1D44',
  middle: '#123264',
  bottom: '#09142F',
};

const LOG_KEY = 'br:logs';
const calendarPic = require('../assets/calendar.webp');

const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DOW_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const getDow = (date) => { const js = date.getDay(); return js === 0 ? 7 : js; };

function makeDays(center = new Date(), back = 60, fwd = 60) {
  const base = new Date(center); base.setHours(0, 0, 0, 0);
  const out = [];
  for (let i = -back; i <= fwd; i++) { const d = new Date(base); d.setDate(base.getDate() + i); out.push(d); }
  return out;
}

function MiniRing({ size=54, stroke=4, progress=0 }) {
  const r  = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, progress));
  const dash = circ * (1 - pct);
  return (
    <View style={{ width:size, height:size }}>
      <Svg width={size} height={size} style={{ transform:[{ rotate: '-90deg' }] }}>
        <Circle cx={cx} cy={cy} r={r} stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={BR.ring} strokeWidth={stroke} fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems:'center', justifyContent:'center' }]}>
        <Text style={styles.circleTxt}>{Math.round(pct*100)}%</Text>
      </View>
    </View>
  );
}

const PAD = 7;
const GAP = 12;
const ITEM_W = Math.floor((W - PAD * 2 - GAP * 3) / 4);

function makeBandPath(w, h, opts) {
  const {
    topY, bottomY,
    ampTop = 0, ampBottom = 0,
    phaseTop = 0, phaseBottom = 0,
    mode = 'between', samples = 24,
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

export default function CalendarScreen() {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const BACK = 60, FWD = 60;
  const [selected, setSelected] = useState(today);
  const [daysData] = useState(() => makeDays(today, BACK, FWD));
  const [logs, setLogs] = useState([]);

  const swipeRefs = useRef({});
  const openIdRef = useRef(null);

  const load = async () => {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      setLogs(raw ? JSON.parse(raw) : []);
    } catch { setLogs([]); }
  };

  useEffect(() => { if (isFocused) load(); }, [isFocused]);

  const visible = useMemo(() => {
    const dow = getDow(selected);
    return logs.filter((l) => Array.isArray(l.days) && l.days.includes(dow));
  }, [logs, selected]);

  const openCreate = () => navigation.navigate('TrainingLog', { mode: 'create' });

  const listRef = useRef(null);
  const snapOffsets = useMemo(() => daysData.map((_, i) => i * (ITEM_W + GAP)), [daysData]);

  useEffect(() => {
    setTimeout(() => {
      listRef.current?.scrollToIndex?.({ index: BACK, animated: false });
    }, 0);
  }, []);

  const deleteById = async (id) => {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const next = arr.filter(x => x.id !== id);
      await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next));
      setLogs(next);
    } finally {
      swipeRefs.current[id]?.close?.();
      openIdRef.current = null;
    }
  };

  const confirmDelete = (id) => {
    Alert.alert(
      'Delete workout?',
      'This action will permanently remove the workout log.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => swipeRefs.current[id]?.close?.() },
        { text: 'Delete', style: 'destructive', onPress: () => deleteById(id) },
      ],
    );
  };

  const RightDummy = () => <View style={{ width: 80 }} />;

  const BLEED = 2;
  const y1 = H * 0.40;
  const y2 = H * 0.72;

  const pathTopFill = makeBandPath(W, H, {
    bottomY: y1 + BLEED, ampBottom: 12, phaseBottom: 0.4, mode: 'above',
  });
  const pathMiddleBand = makeBandPath(W, H, {
    topY: y1 - BLEED, bottomY: y2 + BLEED, ampTop: 12, ampBottom: 16, phaseTop: 0.4, phaseBottom: 1.4, mode: 'between',
  });
  const pathBottomFill = makeBandPath(W, H, {
    topY: y2 - BLEED, ampTop: 16, phaseTop: 1.4, mode: 'below',
  });

  return (
    <View style={styles.wrap}>
      {/* Слоистый фон */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Path d={pathTopFill}    fill={LAYERS.top} />
        <Path d={pathMiddleBand} fill={LAYERS.middle} />
        <Path d={pathBottomFill} fill={LAYERS.bottom} />
      </Svg>

      {/* Хедер */}
      <View style={styles.header}>
        <LinearGradient
          colors={[BR.btn1, BR.btn2]}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={styles.headerIcon}
        >
          <Image source={calendarPic} style={styles.headerIconImg} resizeMode="contain" />
        </LinearGradient>
        <Text style={styles.headerTitle}>ADD YOUR WORKOUT{'\n'}AND START A STREAK</Text>
      </View>

      {/* Лента дат */}
      <FlatList
        ref={listRef}
        data={daysData}
        horizontal
        keyExtractor={(d) => d.toISOString().slice(0, 10)}
        showsHorizontalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingLeft: PAD, paddingRight: PAD, paddingTop: 14, paddingBottom: 8 }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({ length: ITEM_W + GAP, offset: (ITEM_W + GAP) * index, index })}
        renderItem={({ item }) => {
          const active = item.getTime() === selected.getTime();
          const day = item.getDate();
          const name = DOW[item.getDay() === 0 ? 6 : item.getDay() - 1];
          const grad = active ? DATE_ACTIVE : DATE_INACTIVE;
          return (
            <Pressable onPress={() => setSelected(item)} style={styles.dayBox}>
              <LinearGradient
                colors={grad}
                start={{x:0,y:0}} end={{x:1,y:1}}
                style={[styles.dayBg, active && styles.dayBgActive]}
              >
                <Text style={[styles.dayNum, active && styles.dayNumActive]}>
                  {String(day).padStart(2, '0')}
                </Text>
                <Text style={[styles.dayName, active && styles.dayNameActive]}>
                  {name}
                </Text>
              </LinearGradient>
            </Pressable>
          );
        }}
      />

      {/* Контент */}
      <View style={styles.content}>
        {visible.length === 0 ? (
          <View style={styles.empty}>
            <Image source={require('../assets/roo_timer.webp')} style={styles.emptyLogo} resizeMode="contain" />
            <Text style={styles.emptyTxt}>NO WORKOUT YET</Text>
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140, gap: 14 }}
            renderItem={({ item }) => {
              const pct = Math.min(1, Math.max(0, item.progress ?? 0));
              return (
                <Swipeable
                  ref={(r) => { if (r) swipeRefs.current[item.id] = r; }}
                  overshootRight={false}
                  rightThreshold={56}
                  renderRightActions={RightDummy}
                  onSwipeableWillOpen={() => {
                    if (openIdRef.current && openIdRef.current !== item.id) {
                      swipeRefs.current[openIdRef.current]?.close?.();
                    }
                    openIdRef.current = item.id;
                  }}
                  onSwipeableRightOpen={() => confirmDelete(item.id)}
                  onSwipeableClose={() => { if (openIdRef.current === item.id) openIdRef.current = null; }}
                >
                  <Pressable onPress={() => navigation.navigate('Timer', { id: item.id })} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle}>
                        {item.type || 'Workout'} {item.location ? `| ${item.location}` : ''}
                      </Text>
                      <Text style={styles.cardDur}>{minText(item)}</Text>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaLeft}>
                        <MiniRing progress={pct} />
                        <View>
                          <Text style={styles.metaLabel}>Session Intensity</Text>
                          <Text style={styles.metaLabel}>Body Feel</Text>
                        </View>
                      </View>

                      <View style={styles.metaRight}>
                        <Text style={styles.metaVal}>{item.intensity}</Text>
                        <Text style={styles.metaVal}>{item.bodyFeel}</Text>
                      </View>
                    </View>

                    <View style={styles.daysRow}>
                      {item.days?.map((n) => (
                        <View key={n} style={styles.dayChip}>
                          <Text style={styles.dayChipTxt}>{DOW_FULL[n - 1]}</Text>
                        </View>
                      ))}
                    </View>
                  </Pressable>
                </Swipeable>
              );
            }}
          />
        )}
      </View>

      {/* FAB */}
      <Pressable onPress={openCreate} style={styles.fabWrap}>
        <LinearGradient colors={[BR.btn1, BR.btn2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
          <Text style={{ color: '#fff', fontSize: 26, lineHeight: 26, marginTop: -2 }}>＋</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function minText(item) {
  const total =
    (item.workSec || 0) * (item.rounds || 0) +
    (item.restSec || 0) * Math.max(0, (item.rounds || 0) - 1);
  const m = Math.max(1, Math.round(total / 60));
  return `${m} min`;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BR.bg },

  header: { paddingTop: 24, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  headerIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  headerIconImg: { width: 28, height: 28, tintColor: '#fff' },
  headerTitle: { flex: 1, color: BR.text, fontSize: 24, fontWeight: '800', lineHeight: 28 },

  dayBox: { width: ITEM_W, height: 70, borderRadius: 18, overflow: 'hidden' },
  dayBg: {
    flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  dayBgActive: {
    borderColor: 'rgba(44,139,255,0.55)',
    shadowColor: '#2C8BFF',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dayNum: { color: BR.text, fontSize: 16, fontWeight: '700', opacity: 0.9 },
  dayName: { color: BR.text, fontSize: 12, opacity: 0.78, marginTop: 4 },
  dayNumActive: { color: '#fff', fontSize: 16, fontWeight: '800', opacity: 1 },
  dayNameActive: { color: '#fff', fontSize: 12, opacity: 0.95, marginTop: 4 },

  // смещение контента поверх волн — как было
  content: { marginTop: -450, flex: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 110 },
  emptyLogo: { width: 180, height: 180, marginBottom: 12 , borderRadius:25,},
  emptyTxt: { color: BR.text, fontSize: 16, opacity: 0.85 },

  card: {
    backgroundColor: BR.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: BR.text, fontSize: 18, fontWeight: '700' },
  cardDur: { color: BR.btn1, fontSize: 16, fontWeight: '800' },

  metaRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  circleTxt: { color: BR.text, fontWeight: '700' },
  metaRight: { alignItems: 'flex-end' },
  metaLabel: { color: BR.sub, fontSize: 15 },
  metaVal: { color: BR.text, fontSize: 15, marginTop: 4 },

  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  dayChip: { backgroundColor: BR.chip, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  dayChipTxt: { color: '#fff', fontSize: 12 },

  fabWrap: { position: 'absolute', right: 18, bottom: 110 },
  fab: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
