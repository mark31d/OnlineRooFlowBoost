// Components/TrainingLogForm.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  Alert,
  Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W, height: H } = Dimensions.get('window');

const BR = {
  // sapphire blue theme
  bg:    '#0A1533',
  panel: '#111D3C',
  text:  '#FFFFFF',
  sub:   'rgba(224,234,255,0.82)',
  hint:  'rgba(196,210,240,0.55)',
  line:  'rgba(255,255,255,0.10)',
  chip:  '#0F244B',
  acc1:  '#2C8BFF', // gradient A
  acc2:  '#1E74E8', // gradient B
};

const LOG_KEY = 'br:logs';

const INTENSITY = ['Low', 'Moderate', 'Intense', 'Max Effort'];
const BODY_FEEL  = ['Tired', 'Normal', 'Energized'];
const DOW_FULL   = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function OptionSlider({ label, options, value, onChange, styles }) {
  const idx = Math.max(0, options.indexOf(value));
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.sliderWrap}>
        <View style={styles.sliderTrack} />
        {options.map((opt, i) => {
          const active = i === idx;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={[styles.sliderTick, { left: `${(i / (options.length - 1)) * 100}%` }]}
            >
              <View style={[styles.sliderDot, active && styles.sliderDotActive]} />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.sliderValue}>{value}</Text>
    </View>
  );
}

function GradientButton({ title, onPress, disabled, style, styles }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[{ opacity: disabled ? 0.6 : 1 }, style]}>
      <LinearGradient
        colors={[BR.acc1, BR.acc2]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.cta}
      >
        <Text style={styles.ctaTxt}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function SquareBtn({ children, onPress, styles }) {
  return (
    <Pressable onPress={onPress} style={styles.squareBtn}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '600' }}>{children}</Text>
    </Pressable>
  );
}

function SectionCounter({ title, valueText, onMinus, onPlus, styles }) {
  return (
    <View style={{ marginTop: 18 }}>
      <View style={styles.counterRow}>
        <SquareBtn onPress={onMinus} styles={styles}>–</SquareBtn>
        <View style={styles.counterCenter}>
          <Text style={styles.counterValue}>{valueText}</Text>
          <Text style={styles.counterLabel}>{title}</Text>
        </View>
        <SquareBtn onPress={onPlus} styles={styles}>＋</SquareBtn>
      </View>
    </View>
  );
}

export default function TrainingLogForm() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();

  const mode     = route.params?.mode || 'create';
  const editId   = route.params?.id || null;
  const prefill  = route.params?.prefill || null;

  const [step, setStep] = useState(1);
  const [dirty, setDirty] = useState(false);

  const [type, setType] = useState('');
  const [location, setLocation] = useState('');
  const [days, setDays] = useState([]);
  const [intensity, setIntensity] = useState(INTENSITY[0]);
  const [bodyFeel, setBodyFeel]   = useState(BODY_FEEL[1]);
  const [note, setNote] = useState('');

  const [workSec, setWorkSec] = useState(45);
  const [restSec, setRestSec] = useState(10);
  const [rounds,  setRounds]  = useState(3);

  const [createdAt, setCreatedAt] = useState(null);

  const skipGuardRef = useRef(false);
  const dirtyRef = useRef(false);
  useEffect(() => { dirtyRef.current = dirty; }, [dirty]);

  const markDirty = () => !dirty && setDirty(true);

  const hydrate = (src = {}) => {
    setType(src.type || '');
    setLocation(src.location || '');
    setDays(Array.isArray(src.days) ? [...src.days].sort((a,b)=>a-b) : []);
    setIntensity(INTENSITY.includes(src.intensity) ? src.intensity : INTENSITY[0]);
    setBodyFeel(BODY_FEEL.includes(src.bodyFeel) ? src.bodyFeel : BODY_FEEL[1]);
    setNote(src.note || '');
    setWorkSec(Number.isFinite(+src.workSec) ? +src.workSec : 45);
    setRestSec(Number.isFinite(+src.restSec) ? +src.restSec : 10);
    setRounds(Number.isFinite(+src.rounds)  ? +src.rounds  : 3);
    setCreatedAt(src.createdAt || null);
    setDirty(false);
  };

  useEffect(() => { if (prefill) hydrate(prefill); }, [prefill?.id]);

  useEffect(() => {
    if (mode !== 'edit' || !editId) return;
    (async () => {
      try {
        const raw   = await AsyncStorage.getItem(LOG_KEY);
        const arr   = raw ? JSON.parse(raw) : [];
        const found = arr.find(x => x.id === editId);
        if (found) hydrate(found);
      } catch {}
    })();
  }, [mode, editId]);

  useEffect(() => {
    const sub = navigation.addListener('beforeRemove', (e) => {
      if (skipGuardRef.current || !dirtyRef.current) return;
      e.preventDefault();
      Alert.alert(
        'Unsaved Changes',
        "Oops! You haven’t saved your changes yet. What would you like to do?",
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return sub;
  }, [navigation]);

  const toggleDay = (n) => {
    markDirty();
    setDays(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a,b)=>a-b));
  };

  const mmss = (sec) => {
    const s = Math.max(0, Math.round(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
  };

  const onSave = async () => {
    const id = editId || uid();
    const log = {
      id,
      type: type.trim() || 'Workout',
      location: location.trim(),
      days: days.length ? days : [],
      intensity,
      bodyFeel,
      workSec,
      restSec,
      rounds,
      note: note.trim(),
      createdAt: createdAt || new Date().toISOString(),
    };

    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const next = (mode === 'edit' && editId)
        ? arr.map((x) => (x.id === editId ? { ...x, ...log } : x))
        : [log, ...arr];

      await AsyncStorage.setItem(LOG_KEY, JSON.stringify(next));

      setDirty(false);
      skipGuardRef.current = true;
      navigation.goBack();
      setTimeout(() => { skipGuardRef.current = false; }, 400);
    } catch (e) {
      Alert.alert('Error', 'Failed to save the training log.');
    }
  };

  const styles = useMemo(() => makeStyles(insets), [insets]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.titleBox}>
          <Text style={styles.titleTxt}>Training Log</Text>
        </View>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      {step === 1 ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Workout Type</Text>
          <TextInput
            placeholder="Option" placeholderTextColor={BR.hint}
            value={type} onChangeText={(t) => { setType(t); markDirty(); }} style={styles.input}
          />

          <Text style={styles.label}>Training Location</Text>
          <TextInput
            placeholder="Option" placeholderTextColor={BR.hint}
            value={location} onChangeText={(t) => { setLocation(t); markDirty(); }} style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 6 }]}>Days</Text>
          <View style={styles.daysRow}>
            {DOW_FULL.map((d, i) => {
              const num = i + 1;
              const active = days.includes(num);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(num)}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  {active && (
                    <LinearGradient
                      colors={[BR.acc1, BR.acc2]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.dayChipGradient}
                      pointerEvents="none"
                    />
                  )}
                  <Text style={active ? styles.dayTxtActive : styles.dayTxt}>{d}</Text>
                </Pressable>
              );
            })}
          </View>

          <OptionSlider
            label="Session Intensity" options={INTENSITY}
            value={intensity} onChange={(v) => { setIntensity(v); markDirty(); }}
            styles={styles}
          />

          <OptionSlider
            label="Body Feel (Energy / Recovery)" options={BODY_FEEL}
            value={bodyFeel} onChange={(v) => { setBodyFeel(v); markDirty(); }}
            styles={styles}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>Note</Text>
          <TextInput
            placeholder="Write a note..." placeholderTextColor={BR.hint}
            value={note} onChangeText={(t) => { setNote(t); markDirty(); }}
            style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
            multiline
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 140 }}>
          <SectionCounter
            title="WORK DURATION" valueText={mmss(workSec)}
            onMinus={() => { setWorkSec(Math.max(5, workSec - 5)); markDirty(); }}
            onPlus={()  => { setWorkSec(Math.min(60*20, workSec + 5)); markDirty(); }}
            styles={styles}
          />

          <View style={styles.sep} />

          <SectionCounter
            title="REST DURATION" valueText={mmss(restSec)}
            onMinus={() => { setRestSec(Math.max(0, restSec - 5)); markDirty(); }}
            onPlus={()  => { setRestSec(Math.min(60*10, restSec + 5)); markDirty(); }}
            styles={styles}
          />

          <View style={styles.sep} />

          <SectionCounter
            title="ROUNDS" valueText={`${rounds}`}
            onMinus={() => { setRounds(Math.max(1, rounds - 1)); markDirty(); }}
            onPlus={()  => { setRounds(Math.min(50, rounds + 1)); markDirty(); }}
            styles={styles}
          />
        </ScrollView>
      )}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        {step === 1 ? (
          <GradientButton title="Next" onPress={() => setStep(2)} disabled={false} styles={styles} />
        ) : (
          <>
            <GradientButton title="Save" onPress={onSave} styles={styles} />
            <Pressable onPress={() => setStep(1)} style={styles.prevBtn}>
              <Text style={styles.prevBtnTxt}>Previous step</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function makeStyles(insets) {
  return StyleSheet.create({
    wrap: { flex: 1, backgroundColor: BR.bg },

    header: {
      paddingTop: insets.top + 8,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    titleBox: {
      flex: 1,
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      backgroundColor: BR.panel,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    titleTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },
    closeBtn: {
      width: 56, height: 56, borderRadius: 16,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: '#1B2C59',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },

    label: { color: BR.sub, fontSize: 14, marginBottom: 8 },

    input: {
      height: 56,
      borderRadius: 16,
      paddingHorizontal: 16,
      backgroundColor: BR.panel,
      color: BR.text,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: BR.line,
    },

    daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    dayChip: {
      paddingHorizontal: 16, paddingVertical: 14,
      borderRadius: 16, backgroundColor: BR.chip,
      overflow: 'hidden',
      marginRight: 10, marginBottom: 10,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    dayChipActive: { backgroundColor: 'transparent' },
    dayChipGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
    dayTxt: { color: BR.text, fontSize: 14 },
    dayTxtActive:  { color: '#fff', fontSize: 14, fontWeight: '700' },

    sliderWrap: { height: 48, justifyContent: 'center', marginTop: 8 },
    sliderTrack: { position: 'absolute', left: 6, right: 6, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)' },
    sliderTick: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', width: 0 },
    sliderDot:  { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(210,225,255,0.45)' },
    sliderDotActive: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#EAF2FF' },
    sliderValue: { marginTop: 8, color: '#fff', fontSize: 15, textAlign: 'center' },

    counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 18 },
    squareBtn:  {
      width: 64, height: 64, borderRadius: 16,
      backgroundColor: '#1B2C59',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    counterCenter: { alignItems: 'center', justifyContent: 'center', flex: 1 },
    counterValue: { color: '#fff', fontSize: 34, fontWeight: '800' },
    counterLabel: { color: BR.sub, marginTop: 6, letterSpacing: 1.0 },

    sep: { height: 1, backgroundColor: BR.line, marginVertical: 18, marginHorizontal: 8 },

    bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, paddingTop: 8, backgroundColor: BR.bg },
    cta: {
      height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
      shadowColor: BR.acc2, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6,
      borderWidth: 1, borderColor: 'rgba(44,139,255,0.45)',
    },
    ctaTxt: { color: '#fff', fontSize: 18, fontWeight: '600' },
    prevBtn: {
      height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
      backgroundColor: BR.panel, marginTop: 10, borderWidth: 1, borderColor: BR.line,
    },
    prevBtnTxt: { color: '#fff', fontSize: 16 },
  });
}
