// Components/StatsScreen.js
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, G, Line, Text as SvgText } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useRoute, useFocusEffect } from '@react-navigation/native';

const { width: W } = Dimensions.get('window');

/* Sapphire blue palette */
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

const DATA_COLOR = '#2C8BFF';
const AVG_COLOR  = '#7FC3FF';

const LOG_KEY     = 'br:logs';
const TARGETS_KEY = 'br:targets';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dow   = (d) => (d.getDay() === 0 ? 7 : d.getDay());

const safeDate = (v, fallback = new Date()) => {
  try {
    if (!v) return new Date(fallback);
    const d = new Date(v);
    return isNaN(d.getTime()) ? new Date(fallback) : d;
  } catch { return new Date(fallback); }
};

const rangeDays = (from, to) => {
  const out = [];
  const d = new Date(from); d.setHours(0,0,0,0);
  const end = new Date(to); end.setHours(0,0,0,0);
  while (d.getTime() <= end.getTime()) { out.push(new Date(d)); d.setDate(d.getDate() + 1); }
  return out;
};

const parseSec = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (/^\d+:\d{1,2}$/.test(s)) {
      const [m, ss] = s.split(':').map((n) => Number(n) || 0);
      return m * 60 + ss;
    }
    const n = Number(s.replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const minutesForLog = (log) => {
  const work   = parseSec(log?.workSec);
  const rest   = parseSec(log?.restSec);
  const rounds = Number(log?.rounds) || 0;
  const seconds = work * rounds + rest * Math.max(0, rounds - 1);
  return Math.max(1, Math.round(seconds / 60));
};

const fmtHm = (mins) => {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? `${h}h ${r}m` : `${r}m`;
};

const bucketOf = (intensity) => {
  if (intensity === 'Low') return 'easy';
  if (intensity === 'Moderate') return 'moderate';
  return 'hard';
};

export default function StatsScreen() {
  const route = useRoute();

  const [logs, setLogs] = useState([]);
  const [targets, setTargets] = useState({
    weeklyMinutes: 150,
    weights: { consistency: 0.4, time: 0.4, intensity: 0.2 },
  });

  // Принять из params, если прислали
  useEffect(() => {
    const lp = route.params?.logs;
    if (Array.isArray(lp)) setLogs(lp);
    const tp = route.params?.targets;
    if (tp && typeof tp === 'object') setTargets((prev) => ({ ...prev, ...tp }));
  }, [route.params?.logs, route.params?.targets]);

  // Надёжная подгрузка при фокусе (табы / возврат со стеков)
  const loadFromStorage = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(LOG_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      setLogs(Array.isArray(arr) ? arr : []);
    } catch { setLogs([]); }
    try {
      const rawT = await AsyncStorage.getItem(TARGETS_KEY);
      if (rawT) {
        const t = JSON.parse(rawT);
        if (t && typeof t === 'object') setTargets((prev) => ({ ...prev, ...t }));
      }
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { loadFromStorage(); }, [loadFromStorage]));

  // Фильтры
  const FILTERS = useMemo(() => ([
    { key: 'all',  label: 'All',   days: null },
    { key: '7d',   label: 'Week',  days: 7 },
    { key: '30d',  label: 'Month', days: 30 },
  ]), []);
  const [filter, setFilter] = useState(FILTERS[0]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  // старт «all»: либо мин(createdAt), либо 30 дней назад если нет createdAt
  const startDate = useMemo(() => {
    if (!filter.days) {
      const created = logs
        .map(l => safeDate(l.createdAt, today).getTime())
        .filter(n => Number.isFinite(n));
      if (!created.length) {
        const d = new Date(today); d.setDate(d.getDate() - 30); return d;
      }
      const min = new Date(Math.min(...created));
      const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 120);
      return min < cutoff ? cutoff : min;
    }
    const d = new Date(today); d.setDate(d.getDate() - (filter.days - 1)); return d;
  }, [filter, logs, today]);

  const days = useMemo(() => rangeDays(startDate, today), [startDate, today]);

  // Агрегация по дням
  const perDay = useMemo(() => {
    if (!Array.isArray(days) || !days.length) return [];
    return days.map((d) => {
      const dayNum = dow(d);
      let mins = 0, sessions = 0;
      const buckets = { easy: 0, moderate: 0, hard: 0 };

      for (const log of logs) {
        const created = safeDate(log?.createdAt, new Date(0));
        created.setHours(0,0,0,0);
        // если есть явные дни — используем их; иначе — день создания
        const storedDays = Array.isArray(log?.days)
          ? log.days.map((x) => Number(x)).filter((n) => Number.isFinite(n))
          : [];
        const effectiveDays = storedDays.length ? storedDays : [dow(created)];
        if (!effectiveDays.includes(dayNum)) continue;

        const m = minutesForLog(log);
        mins += m;
        sessions += 1;
        buckets[bucketOf(log?.intensity || 'Moderate')] += 1;
      }

      return { date: d, minutes: mins, sessions, buckets };
    });
  }, [days, logs]);

  // Агрегаты
  const totalMinutes    = useMemo(() => perDay.reduce((s, it) => s + (it?.minutes || 0), 0), [perDay]);
  const totalSessions   = useMemo(() => perDay.reduce((s, it) => s + (it?.sessions || 0), 0), [perDay]);
  const workoutsPerWeek = useMemo(() => totalSessions / Math.max(1, (perDay.length / 7)), [perDay.length, totalSessions]);

  const bestStreak = useMemo(() => {
    let max = 0, cur = 0;
    perDay.forEach((d) => { if ((d?.minutes || 0) > 0) { cur += 1; if (cur > max) max = cur; } else cur = 0; });
    return max;
  }, [perDay]);

  const intensityScore = useMemo(() => {
    const agg = { easy: 0, moderate: 0, hard: 0 };
    perDay.forEach((d) => { agg.easy += d.buckets.easy; agg.moderate += d.buckets.moderate; agg.hard += d.buckets.hard; });
    const total = agg.easy + agg.moderate + agg.hard;
    if (total === 0) return 0;
    const actual = { easy: agg.easy/total, moderate: agg.moderate/total, hard: agg.hard/total };
    const target = { easy: 0.4, moderate: 0.4, hard: 0.2 };
    const diff = (Math.abs(actual.easy-target.easy)+Math.abs(actual.moderate-target.moderate)+Math.abs(actual.hard-target.hard))/3;
    return clamp(1 - diff * 3, 0, 1);
  }, [perDay]);

  const consistency = useMemo(() => {
    const last7 = perDay.slice(-7);
    if (last7.length === 0) return 0;
    const active = last7.filter(d => (d?.minutes || 0) > 0).length;
    return active / last7.length;
  }, [perDay]);

  const timeGoal = useMemo(() => {
    const last7 = perDay.slice(-7);
    const mins = last7.reduce((s, d) => s + (d?.minutes || 0), 0);
    return clamp(mins / (targets.weeklyMinutes || 150), 0, 1);
  }, [perDay, targets.weeklyMinutes]);

  const flowScore = useMemo(() => {
    const w = targets.weights || { consistency: 0.4, time: 0.4, intensity: 0.2 };
    const s = consistency * (w.consistency ?? 0.4) +
              timeGoal   * (w.time ?? 0.4) +
              intensityScore * (w.intensity ?? 0.2);
    return Math.round(s * 100);
  }, [consistency, timeGoal, intensityScore, targets.weights]);

  // Данные для графика
  const chart = useMemo(() => {
    const data = perDay.map(d => d.minutes);
    const avg = data.length
      ? data.map((_, i) => {
          const slice = data.slice(Math.max(0, i - 6), i + 1);
          const m = slice.reduce((s, x) => s + x, 0) / slice.length;
          return Math.round(m);
        })
      : [];
    return { data, avg, days };
  }, [perDay, days]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>STATS</Text>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInset={{ bottom: 160 }}
        contentInsetAdjustmentBehavior="always"
        showsVerticalScrollIndicator={false}
      >
        {/* фильтр */}
        <View style={styles.filterRow}>
          {[
            { key: 'all',  label: 'All',   days: null },
            { key: '7d',   label: 'Week',  days: 7 },
            { key: '30d',  label: 'Month', days: 30 },
          ].map((f) => {
            const active = f.key === filter.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f)} style={styles.seg}>
                {active && (
                  <LinearGradient
                    colors={[BR.gold1, BR.gold2]}
                    start={{x:0,y:0}} end={{x:1,y:1}}
                    style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]}
                    pointerEvents="none"
                  />
                )}
                <Text style={[styles.segTxt, active && styles.segTxtActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* метрики */}
        <View style={styles.grid}>
          <MetricCard title="Flow Score" value={`${flowScore}%`} />
          <MetricCard title="Workouts"   value={workoutsPerWeek.toFixed(1)} suffix="/Week" />
          <MetricCard title="Total Time" value={fmtHm(totalMinutes)} />
          <MetricCard title="Best Streak" value={`${bestStreak} days`} />
        </View>

        {/* график */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Training Time Trend</Text>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <LegendDot color={DATA_COLOR} label="Daily" />
              <LegendDot color={AVG_COLOR}  label="7-day Avg" />
            </View>
          </View>
          <LineChart width={W - 32} height={260} series={chart} />
        </View>

        <Text style={styles.targets}>Targets in Settings: {targets.weeklyMinutes} min/week</Text>
      </ScrollView>
    </View>
  );
}

function MetricCard({ title, value, suffix }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={styles.cardValue}>{value}</Text>
        {!!suffix && <Text style={[styles.cardTitle, { marginLeft: 6 }]}>{suffix}</Text>}
      </View>
    </View>
  );
}

function LegendDot({ color, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: BR.sub, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

/* ====== Chart with day/minute grid & labels ====== */
function LineChart({ width, height, series }) {
  const padding = { t: 12, r: 12, b: 34, l: 44 };
  const w = Math.max(1, width - padding.l - padding.r);
  const h = Math.max(1, height - padding.t - padding.b);

  const X = Math.max(1, series.data.length);
  const maxData = Math.max(0, ...series.data, ...series.avg);
  const maxY = Math.max(10, Math.ceil(maxData * 1.3));

  const scaleX = (i) => (i / Math.max(1, X - 1)) * w;
  const scaleY = (v) => h - (v / (maxY || 1)) * h;

  const pathFor = (arr) => {
    if (!arr.length) return '';
    return arr
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${padding.l + scaleX(i)} ${padding.t + scaleY(v)}`)
      .join(' ');
  };

  const dataPath = pathFor(series.data);
  const avgPath  = pathFor(series.avg);

  // ---- ticks & labels ----
  const yTicks = useMemo(() => {
    const steps = [5, 10, 15, 20, 25, 30, 50, 75, 100, 150, 200, 300, 500];
    const targetLines = 5;
    const approx = maxY / targetLines;
    const step = steps.find(s => s >= approx) || 500;
    const arr = [];
    for (let v = 0; v <= maxY; v += step) arr.push(v);
    if (arr[arr.length - 1] !== maxY) arr.push(maxY);
    return arr;
  }, [maxY]);

  const xTicks = useMemo(() => {
    const N = series.days?.length || 0;
    if (N === 0) return [];
    if (N <= 7) return Array.from({ length: N }, (_, i) => i);
    const marks = 7;
    return Array.from({ length: marks }, (_, k) => Math.round((k / (marks - 1)) * (N - 1)));
  }, [series.days]);

  const dayLabel = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
    return `${dd} ${mm}`;
  };

  return (
    <Svg width={width} height={height}>
      {/* horizontal grid + Y labels (minutes) */}
      <G>
        {yTicks.map((v, i) => {
          const y = padding.t + scaleY(v);
          return (
            <G key={`y${i}`}>
              <Line
                x1={padding.l}
                y1={y}
                x2={padding.l + w}
                y2={y}
                stroke={BR.line}
                strokeWidth={1}
              />
              <SvgText
                x={padding.l - 8}
                y={y + 4}
                fontSize="10"
                fill={BR.sub}
                textAnchor="end"
              >
                {v}
              </SvgText>
            </G>
          );
        })}
      </G>

      {/* vertical grid + X labels (days) */}
      <G>
        {xTicks.map((idx, i) => {
          const x = padding.l + scaleX(idx);
          const d = series.days?.[idx];
          return (
            <G key={`x${i}`}>
              <Line
                x1={x}
                y1={padding.t}
                x2={x}
                y2={padding.t + h}
                stroke={BR.line}
                strokeWidth={1}
              />
              {d && (
                <SvgText
                  x={x}
                  y={padding.t + h + 16}
                  fontSize="10"
                  fill={BR.sub}
                  textAnchor="middle"
                >
                  {dayLabel(d)}
                </SvgText>
              )}
            </G>
          );
        })}
      </G>

      {/* data */}
      {dataPath ? <Path d={dataPath} stroke={DATA_COLOR} strokeWidth={3} fill="none" /> : null}
      {series.data.map((v, i) => (
        <Circle
          key={`c${i}`}
          cx={padding.l + scaleX(i)}
          cy={padding.t + scaleY(v)}
          r={4}
          fill={DATA_COLOR}
        />
      ))}

      {/* average */}
      {avgPath ? <Path d={avgPath} stroke={AVG_COLOR} strokeWidth={3} fill="none" opacity={0.9} /> : null}
      {series.avg.map((v, i) => (
        <Circle
          key={`a${i}`}
          cx={padding.l + scaleX(i)}
          cy={padding.t + scaleY(v)}
          r={3.5}
          fill={AVG_COLOR}
        />
      ))}
    </Svg>
  );
}

/* --- styles --- */
const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BR.bg, paddingHorizontal: 16, paddingTop: 16 },
  h1:   { color: BR.text, fontSize: 28, fontWeight: '800', marginBottom: 12 },

  scrollContent: { paddingBottom: 200 },

  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  seg: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: BR.chip,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  segTxt: { fontSize: 15, fontWeight: '700', color: BR.text, opacity: 0.9 },
  segTxtActive: { color: '#fff', opacity: 1 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    width: (W - 16 * 2 - 12) / 2,
    minHeight: 92,
    backgroundColor: BR.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: { color: BR.sub, fontSize: 14, marginBottom: 6 },
  cardValue: { color: BR.text, fontSize: 28, fontWeight: '800' },

  chartCard: {
    backgroundColor: BR.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 6,
  },
  chartTitle: { color: BR.text, fontSize: 16, fontWeight: '800' },

  targets: { color: BR.sub, fontSize: 12, textAlign: 'right', marginTop: 4 },
});
