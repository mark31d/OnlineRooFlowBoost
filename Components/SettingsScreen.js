// Components/SettingsScreen.js
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Share,
  Modal,
  Image,
  Platform,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BR = {
  bg:    '#0A1533',
  card:  '#111D3C',
  text:  '#FFFFFF',
  sub:   'rgba(224,234,255,0.82)',
  line:  'rgba(255,255,255,0.12)',
  gold1: '#2C8BFF', // gradient A
  gold2: '#1E74E8', // gradient B
  chip:  '#1B2C59',
};

const icShare = require('../assets/ic_share.webp');
const icReset = require('../assets/ic_reset.webp');

export default function SettingsScreen() {
  const [settings, setSettings] = useState({ notifications: true, sound: true });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('br:settings');
        if (raw) setSettings(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setSettings(next);
    try { await AsyncStorage.setItem('br:settings', JSON.stringify(next)); } catch {}
  }, []);

  const toggle = (k) => {
    const next = { ...settings, [k]: !settings[k] };
    persist(next);
  };

  const onShare = async () => {
    try {
      await Share.share({
        message:
          'Boost Roo — Better Flow. Plan quick workouts, track streaks, and grow with Roo! https://example.com/boostroo',
      });
    } catch {}
  };

  const onResetAll = async () => {
    setConfirmOpen(false);
    try {
      const all = await AsyncStorage.getAllKeys();
      const brKeys = all.filter((k) => k.startsWith('br:'));
      await AsyncStorage.multiRemove(brKeys);
    } catch {}
  };

  const openTerms = () => {
    Alert.alert('Coming soon', 'Terms of Use / Privacy Policy will be added soon.', [
      { text: 'OK' },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>SETTINGS</Text>

      <Row>
        <Text style={styles.label}>Notifications</Text>
        <Switch
          value={settings.notifications}
          onValueChange={() => toggle('notifications')}
          trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#1E74E8' }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </Row>

      <Row>
        <Text style={styles.label}>Sound</Text>
        <Switch
          value={settings.sound}
          onValueChange={() => toggle('sound')}
          trackColor={{ false: 'rgba(255,255,255,0.25)', true: '#1E74E8' }}
          thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
        />
      </Row>

      <Pressable onPress={onShare} style={styles.row}>
        <Text style={styles.label}>Share the app</Text>
        <Image source={icShare} style={styles.icon} />
      </Pressable>

      <Pressable onPress={() => setConfirmOpen(true)} style={styles.row}>
        <Text style={styles.label}>Reset all data</Text>
        <Image source={icReset} style={styles.icon} />
      </Pressable>

      <Pressable onPress={openTerms} style={styles.row}>
        <Text style={styles.label}>Terms of Use / Privacy Policy</Text>
      </Pressable>

      <Modal
        visible={confirmOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmOpen(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.dialog}>
            <Text style={styles.dTitle}>Reset all data?</Text>
            <Text style={styles.dText}>
              This will permanently delete your workouts, stats, and streaks. This action can’t be
              undone.
            </Text>

            <View style={styles.dBtns}>
              <Pressable onPress={() => setConfirmOpen(false)} style={[styles.dBtn, styles.dCancel]}>
                <Text style={[styles.dBtnTxt, { color: '#FFEBD1' }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={onResetAll} style={[styles.dBtn, styles.dDanger]}>
                <Text style={[styles.dBtnTxt, { color: '#E53935' }]}>Reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Row({ children }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BR.bg, paddingHorizontal: 16 },
  h1: { color: BR.text, fontSize: 28, fontWeight: '800', marginTop: 16, marginBottom: 10 },

  row: {
    backgroundColor: BR.row,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  label: { color: BR.text, fontSize: 16, fontWeight: '600' },
  icon: { width: 22, height: 22, tintColor: '#fff', resizeMode: 'contain' },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  dialog: {
    width: '86%',
    backgroundColor: BR.row,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  dTitle: { fontSize: 20, fontWeight: '800', color: BR.text, textAlign: 'center', marginBottom: 10 },
  dText: { fontSize: 15, color: BR.sub, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
  dBtns: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  dBtn: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center' },
  dCancel: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(255,255,255,0.12)',
  },
  dDanger: {},
  dBtnTxt: { fontSize: 17, fontWeight: '700' },
});
