import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Vibration,
  BackHandler, Image, Platform, ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';

const BR = {
  // sapphire blue theme
  bg:    '#0A1533',
  card:  '#111D3C',
  text:  '#FFFFFF',
  sub:   'rgba(224,234,255,0.82)',
  line:  'rgba(255,255,255,0.12)',
  acc1:  '#2C8BFF',   // gradient A
  acc2:  '#1E74E8',   // gradient B
  ring:  '#4DA3FF',   // progress ring
};

const LOG_KEY = 'br:logs';
const icClose = require('../assets/ic_close.webp');
const icEdit  = require('../assets/ic_edit.webp');

const pad = (n) => String(n).padStart(2, '0');
const fmt = (sec) => {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad(m)}:${pad(r)}`;
};
function formatNiceDate(d = new Date()) {
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
  const mm = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${wd} ${d.getDate()} ${mm}`;
}

function ProgressRing({ size=220, stroke=6, progress=0, trackColor='rgba(255,255,255,0.22)', color=BR.ring, children }) {
  const r  = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, progress));
  const dash = circ * (1 - pct);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          strokeLinecap="round"
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems:'center', justifyContent:'center' }]}>{children}</View>
    </View>
  );
}

export default function TimerModal({ navigation, route }) {
  const id = route?.params?.id ?? null;
  const isFocused = useIsFocused();

  const [log, setLog] = useState(null);
  const [overallPct, setOverallPct] = useState(0);

  const loadLog = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const found = id ? arr.find((x) => x.id === id) : null;
      setLog(found || null);
      setOverallPct(found?.progress ?? 0);
    } catch {
      setLog(null);
      setOverallPct(0);
    }
  }, [id]);

  useEffect(() => { loadLog(); }, [loadLog]);
  useEffect(() => { if (isFocused) loadLog(); }, [isFocused, loadLog]);

  const lastSaveRef = useRef(0);
  useEffect(() => {
    if (!log?.id) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 800 && overallPct < 1 && overallPct > 0) return;
    lastSaveRef.current = now;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LOG_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        const i = arr.findIndex(x => x.id === log.id);
        if (i !== -1) {
          arr[i] = { ...arr[i], progress: overallPct };
          await AsyncStorage.setItem(LOG_KEY, JSON.stringify(arr));
          setLog(arr[i]);
        }
      } catch {}
    })();
  }, [overallPct, log?.id]);

  const [showSheet, setShowSheet] = useState(false);

  const title = useMemo(() => {
    if (!log) return 'Workout';
    return `${log.type || 'Workout'}${log.location ? ' | ' + log.location : ''}`;
  }, [log]);

  const workSec = Number(log?.workSec ?? 45);
  const restSec = Number(log?.restSec ?? 10);
  const rounds  = Number(log?.rounds  ?? 3);

  const onClose = () => navigation.goBack();

  const onEdit = useCallback(() => {
       if (!log?.id) return;
       setShowSheet(false);
       navigation.replace('TrainingLog', { mode: 'edit', id: log.id, prefill: log });
     }, [navigation, log]);

  const pctLabel = `${Math.round((overallPct ?? 0) * 100)}%`;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hTitle}>{title}</Text>
          <Text style={styles.hDate}>{formatNiceDate(new Date())}</Text>
        </View>
        <Pressable onPress={onClose} style={styles.hClose}>
          <Image source={icClose} style={{ width: 20, height: 20, tintColor: '#fff' }} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
        <View style={styles.ringWrap}>
          <ProgressRing size={220} stroke={6} progress={overallPct} color={BR.ring} trackColor="rgba(255,255,255,0.22)">
            <View style={styles.ringInner}>
              <Text style={styles.ringPct}>{pctLabel}</Text>
            </View>
          </ProgressRing>
        </View>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kLabel}>Session Intensity</Text>
            <Text style={styles.kLabel}>Body Feel</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.kVal}>{log?.intensity || 'Low'}</Text>
            <Text style={styles.kVal}>{log?.bodyFeel || 'Normal'}</Text>
          </View>
        </View>

        {!!log?.note && <Text style={styles.note}>{log.note}</Text>}

        <View style={styles.metricsRow}>
          <View style={styles.metricCell}>
            <Text style={styles.metricBig}>{fmt(workSec)}</Text>
            <Text style={styles.metricCap}>WORK DURATION</Text>
          </View>
          <View style={styles.vSep} />
          <View style={styles.metricCell}>
            <Text style={styles.metricBig}>{fmt(restSec)}</Text>
            <Text style={styles.metricCap}>REST DURATION</Text>
          </View>
          <View style={styles.vSep} />
          <View style={styles.metricCell}>
            <Text style={styles.metricBig}>{rounds}</Text>
            <Text style={styles.metricCap}>ROUNDS</Text>
          </View>
        </View>
      </ScrollView>

      <Pressable onPress={onEdit} style={styles.fabWrap}>
        <LinearGradient colors={[BR.acc1, BR.acc2]} start={{ x:0, y:0 }} end={{ x:1, y:1 }} style={styles.fab}>
          <Image source={icEdit} style={{ width: 20, height: 20, tintColor: '#fff' }} />
        </LinearGradient>
      </Pressable>

      <Pressable onPress={() => setShowSheet(true)} style={styles.bottomBtnWrap}>
        <LinearGradient colors={[BR.acc1, BR.acc2]} start={{ x:0, y:0 }} end={{ x:1, y:1 }} style={styles.bottomBtn}>
          <Text style={styles.bottomBtnTxt}>Start</Text>
        </LinearGradient>
      </Pressable>

      {showSheet && (
        <TimerSheet
          workDefault={workSec}
          restDefault={restSec}
          roundsTotal={rounds}
          onProgress={(p) => setOverallPct(p)}
          onClose={() => setShowSheet(false)}
        />
      )}
    </View>
  );
}

function TimerSheet({ workDefault=45, restDefault=10, roundsTotal=3, onProgress, onClose }) {
  const [phase, setPhase] = useState('idle');
  const [left, setLeft]   = useState(workDefault);
  const [round, setRound] = useState(1);
  const [soundOn, setSoundOn] = useState(true);

  const intervalRef = useRef(null);
  const elapsedRef  = useRef(0);
  const lastPhaseRef = useRef('work');

  const totalPlanSec = Math.max(1, roundsTotal * (workDefault + restDefault));

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('br:settings');
        if (raw) {
          const s = JSON.parse(raw);
          if (typeof s.sound === 'boolean') setSoundOn(s.sound);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => { onClose?.(); return true; });
    return () => h.remove();
  }, [onClose]);

  const vibrate = useCallback(() => {
    if (!soundOn) return;
    if (Platform.OS === 'ios' || Platform.OS === 'android') Vibration.vibrate(80);
  }, [soundOn]);

  const clear = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const reportProgress = useCallback(() => {
    const p = Math.min(1, elapsedRef.current / totalPlanSec);
    onProgress?.(p);
  }, [onProgress, totalPlanSec]);

  const tick = useCallback(() => {
    elapsedRef.current += 1;
    reportProgress();
    setLeft(prev => Math.max(0, prev - 1));
  }, [reportProgress]);

  useEffect(() => {
    if ((phase === 'work' || phase === 'rest') && left === 0) {
      nextPhase();
    }
  }, [left, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const startInterval = useCallback(() => {
    clear();
    intervalRef.current = setInterval(tick, 1000);
  }, [tick, clear]);

  const startWork = useCallback(() => {
    lastPhaseRef.current = 'work';
    setPhase('work');
    setLeft(workDefault);
    startInterval();
    vibrate();
  }, [workDefault, startInterval, vibrate]);

  const startRest = useCallback(() => {
    lastPhaseRef.current = 'rest';
    setPhase('rest');
    setLeft(restDefault);
    startInterval();
    vibrate();
  }, [restDefault, startInterval, vibrate]);

  const finish = useCallback(() => {
    clear();
    setPhase('done');
    onProgress?.(1);
    vibrate();
  }, [clear, onProgress, vibrate]);

  const nextPhase = useCallback(() => {
    clear();
    if (phase === 'work') {
      if (restDefault > 0) {
        const nextRound = Math.min(roundsTotal, round + 1);
        setRound(nextRound);
        startRest();
      } else {
        if (round >= roundsTotal) finish();
        else { setRound(round + 1); startWork(); }
      }
      return;
    }
    if (phase === 'rest') {
      if (round >= roundsTotal) finish();
      else startWork();
    }
  }, [phase, round, restDefault, roundsTotal, clear, startRest, startWork, finish]);

  useEffect(() => () => clear(), [clear]);

  const onStart  = () => {
    elapsedRef.current = 0;
    onProgress?.(0);
    setRound(1);
    startWork();
  };
  const onPause  = () => { lastPhaseRef.current = phase; setPhase('paused'); clear(); };
  const onResume = () => {
    const to = lastPhaseRef.current === 'rest' ? startRest : startWork;
    to();
  };

  const primary = useMemo(() => {
    if (phase === 'idle')   return { label: 'Start',  onPress: onStart };
    if (phase === 'work')   return { label: 'Pause',  onPress: onPause };
    if (phase === 'rest')   return { label: 'Pause',  onPress: onPause };
    if (phase === 'paused') return { label: 'Resume', onPress: onResume };
    if (phase === 'done')   return { label: 'Close',  onPress: onClose };
    return { label: 'Start', onPress: onStart };
  }, [phase, onStart, onPause, onResume, onClose]);

  const headerText = `${Math.min(round, roundsTotal)}/${roundsTotal} ROUNDS`;
  const bigTime    = fmt(Math.max(0, left));
  const subText    = phase === 'rest' ? 'REST' : 'WORK';

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.rounds}>{headerText}</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Image source={icClose} style={{ width: 18, height: 18, tintColor: '#fff' }} />
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 16 }}>
            <Text style={styles.time}>{bigTime}</Text>
            <Text style={styles.sub}>{phase === 'done' ? 'DONE' : subText}</Text>
          </View>

          <Pressable onPress={primary.onPress} style={{ alignSelf: 'stretch' }}>
            <LinearGradient colors={[BR.acc1, BR.acc2]} start={{ x:0, y:0 }} end={{ x:1, y:1 }} style={styles.primary}>
              <Text style={styles.primaryTxt}>{primary.label}</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BR.bg },

  headerRow: {
    paddingTop: 18, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  hTitle: { color: BR.acc1, fontSize: 28, fontWeight: '800' },
  hDate:  { color: BR.sub,  fontSize: 16, marginTop: 4 },
  hClose: {
    marginLeft: 10, width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#1B2C59', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },

  ringWrap: { alignItems: 'center', marginTop: 8, marginBottom: 18 },
  ringInner: {
    width: 180, height: 180, borderRadius: 90,
    borderWidth: 2, borderColor: 'rgba(210,225,255,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  ringPct: { color: '#fff', fontSize: 28, fontWeight: '800' },

  twoCol: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8, marginBottom: 8 },
  kLabel: { color: BR.sub, fontSize: 18, marginBottom: 14 },
  kVal:   { color: BR.text, fontSize: 18, marginBottom: 14 },

  note: { color: BR.text, opacity: 0.92, fontSize: 16, marginTop: 6, marginBottom: 10 },

  metricsRow: { flexDirection: 'row', alignItems: 'stretch', marginTop: 8, marginBottom: 20 },
  vSep: { width: 1, backgroundColor: BR.line, marginHorizontal: 12 },
  metricCell: { flex: 1, alignItems: 'center' },
  metricBig:  { color: '#fff', fontSize: 32, fontWeight: '800' },
  metricCap:  { color: BR.sub, fontSize: 12, marginTop: 6, letterSpacing: 1 },

  fabWrap: { position: 'absolute', right: 20, bottom: 120, zIndex: 99, elevation: 12 },
  fab: {
    width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(44,139,255,0.45)',
  },

  bottomBtnWrap: { position: 'absolute', left: 16, right: 16, bottom: 32 },
  bottomBtn: {
    height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(44,139,255,0.45)',
    ...Platform.select({
      ios: { shadowColor: BR.acc2, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },
  bottomBtnTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { backgroundColor: BR.card, borderRadius: 22, padding: 18, alignSelf: 'stretch' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rounds: { color: BR.text, fontWeight: '800', fontSize: 18, letterSpacing: 0.2 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#1B2C59',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  time: { color: BR.text, fontSize: 56, fontWeight: '800', letterSpacing: 1 },
  sub:  { color: BR.sub, fontSize: 16, marginTop: 4 },
  primary: {
    height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(44,139,255,0.45)',
    ...Platform.select({
      ios: { shadowColor: BR.acc2, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 6 },
    }),
  },
  primaryTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
