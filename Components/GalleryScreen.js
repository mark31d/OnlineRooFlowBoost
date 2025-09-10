// Components/GalleryScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  Pressable,
  Alert,
  Modal,
  Dimensions,
  Share,
  ScrollView,
  StatusBar,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: W } = Dimensions.get('window');

/* Sapphire / Neo-Blue */
const BR = {
  bg:     '#0A1533',
  card:   '#0E1A39',
  chip:   '#12214A',
  glass:  'rgba(255,255,255,0.04)',
  text:   '#FFFFFF',
  sub:    'rgba(224,234,255,0.82)',
  border: 'rgba(255,255,255,0.08)',
  line:   'rgba(255,255,255,0.14)',

  acc1:   '#2C8BFF',
  acc2:   '#1E74E8',
};

const GALLERY_KEY = 'br:gallery';

const fmtDate = (iso) => {
  const d = new Date(iso);
  const day = d.toLocaleString(undefined, { day: '2-digit' });
  const mon = d.toLocaleString(undefined, { month: 'short' });
  const yr  = d.getFullYear();
  return `${day} ${mon} ${yr}`;
};

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

/* ---------- Segmented ---------- */
function Segmented({ value, onChange }) {
  const options = [
    { key: 'grid',    label: 'Grid' },
    { key: 'compare', label: 'Compare' },
  ];
  return (
    <View style={segStyles.wrap}>
      {options.map((opt, idx) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[segStyles.item, active && segStyles.itemOn, idx === options.length - 1 && { marginRight: 0 }]}
          >
            {active && (
              <LinearGradient
                colors={[BR.acc1, BR.acc2]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={segStyles.bg}
              />
            )}
            <Text numberOfLines={1} style={active ? segStyles.txtOn : segStyles.txt}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const segStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: BR.chip,
    borderRadius: 18,
    padding: 6,
    borderWidth: 1,
    borderColor: BR.border,
  },
  item: {
    minWidth: 92,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 6,
  },
  itemOn: {},
  bg: { ...StyleSheet.absoluteFillObject, borderRadius: 14 },
  txt:   { color: BR.sub, fontWeight: '700', includeFontPadding: false },
  txtOn: { color: '#fff', fontWeight: '800', includeFontPadding: false },
});

/* ---------- Главный экран ---------- */
export default function GalleryScreen() {
  const insets = useSafeAreaInsets();

  // item: { id, type: 'photo'|'text', uri?, text?, createdAt, fav? }
  const [tab, setTab] = useState('grid');
  const [items, setItems] = useState([]);
  const [picker, setPicker] = useState({ visible: false, target: null, mode: 'grid' });
  const [compare, setCompare] = useState({ leftId: null, rightId: null });
  const [onlyFav, setOnlyFav] = useState(false);

  // модалки для добавления/редактирования текста
  const [addMenu, setAddMenu] = useState(false);
  const [textEditor, setTextEditor] = useState({ visible: false, id: null, value: '' });

  // load
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(GALLERY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        const safe = Array.isArray(arr)
          ? arr.map(it => (it.uri && !it.type ? { ...it, type: 'photo' } : it))
          : [];
        setItems(safe);
        const photos = safe.filter(x => x.type === 'photo');
        if (photos.length) {
          setCompare({
            leftId:  photos[0]?.id ?? null,
            rightId: photos[1]?.id ?? photos[0]?.id ?? null,
          });
        }
      } catch {}
    })();
  }, []);

  const save = async (next) => {
    setItems(next);
    try { await AsyncStorage.setItem(GALLERY_KEY, JSON.stringify(next)); } catch {}
  };

  // ---- add from library ----
  const addFromLibrary = async () => {
    try {
      const { launchImageLibrary } = require('react-native-image-picker');
      const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 6 });
      if (res?.assets?.length) {
        const toAdd = res.assets
          .filter(a => !!a?.uri)
          .map(a => ({
            id: uid(),
            type: 'photo',
            uri: a.uri,
            createdAt: new Date().toISOString(),
            fav: false,
          }));
        if (!toAdd.length) return;
        const next = [...toAdd, ...items];
        await save(next);
        const photos = next.filter(x => x.type === 'photo');
        if (!compare.leftId && photos.length) {
          setCompare({ leftId: photos[0].id, rightId: photos[1]?.id ?? photos[0].id });
        }
      }
    } catch {}
  };

  // ---- add text item ----
  const addTextItem = () => {
    setAddMenu(false);
    setTextEditor({ visible: true, id: null, value: '' });
  };
  const editTextItem = (id, current) => {
    setTextEditor({ visible: true, id, value: current || '' });
  };
  const saveText = async () => {
    const v = textEditor.value.trim();
    if (!v) { setTextEditor({ visible: false, id: null, value: '' }); return; }
    if (textEditor.id) {
      const next = items.map(it => it.id === textEditor.id ? { ...it, text: v } : it);
      await save(next);
    } else {
      const next = [
        {
          id: uid(),
          type: 'text',
          text: v,
          createdAt: new Date().toISOString(),
          fav: false,
        },
        ...items,
      ];
      await save(next);
    }
    setTextEditor({ visible: false, id: null, value: '' });
  };

  // delete
  const onDelete = (id) => {
    Alert.alert(
      'Delete item?',
      "This will remove it from your Gallery. This action can’t be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const next = items.filter(x => x.id !== id);
            await save(next);
            const photos = next.filter(x => x.type === 'photo');
            setCompare((prev) => ({
              leftId:  prev.leftId  === id ? photos[0]?.id ?? null : prev.leftId,
              rightId: prev.rightId === id ? photos[1]?.id ?? photos[0]?.id ?? null : prev.rightId,
            }));
          },
        },
      ]
    );
  };

  // toggle fav
  const toggleFav = async (id) => {
    const next = items.map(it => (it.id === id ? { ...it, fav: !it.fav } : it));
    await save(next);
  };

  // picker from existing list (только фото)
  const openReplaceInGrid = (index) => setPicker({ visible: true, target: index, mode: 'grid' });
  const openReplaceLeft   = () => setPicker({ visible: true, target: 'left',  mode: 'compare' });
  const openReplaceRight  = () => setPicker({ visible: true, target: 'right', mode: 'compare' });

  const onPickExisting = async (chosenId) => {
    const photos = items.filter(x => x.type === 'photo');
    if (!photos.length) { setPicker({ visible: false, target: null, mode: 'grid' }); return; }

    if (picker.mode === 'grid' && typeof picker.target === 'number') {
      const targetIdx = picker.target;
      const chosenIdx = items.findIndex(x => x.id === chosenId);
      if (chosenIdx < 0 || targetIdx < 0 || targetIdx >= items.length) {
        setPicker({ visible: false, target: null, mode: 'grid' });
        return;
      }
      const next = [...items];
      const tmp = next[targetIdx];
      next[targetIdx] = next[chosenIdx];
      next[chosenIdx] = tmp;
      await save(next);
    } else if (picker.mode === 'compare') {
      setCompare((prev) => ({
        leftId:  picker.target === 'left'  ? chosenId : prev.leftId,
        rightId: picker.target === 'right' ? chosenId : prev.rightId,
      }));
    }
    setPicker({ visible: false, target: null, mode: 'grid' });
  };

  const filtered = useMemo(() => (onlyFav ? items.filter(i => i.fav) : items), [items, onlyFav]);

  const photosOnly = useMemo(() => filtered.filter(x => x.type === 'photo'), [filtered]);
  const leftItem  = useMemo(() => items.find(x => x.id === compare.leftId)  || null, [items, compare.leftId]);
  const rightItem = useMemo(() => items.find(x => x.id === compare.rightId) || null, [items, compare.rightId]);

  return (
    <View style={styles.wrap}>
      <StatusBar barStyle="light-content" />
      <Text style={[styles.h1, { marginTop: insets.top + 4 }]}>PROGRESS GALLERY</Text>

      <View style={styles.controlsRow}>
        <Segmented value={tab} onChange={setTab} />
        <Pressable onPress={() => setOnlyFav(v => !v)} style={[styles.starBtn, onlyFav && styles.starOn]}>
          <LinearGradient
            colors={onlyFav ? [BR.acc1, BR.acc2] : [BR.chip, BR.chip]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.starBg}
          />
          <Text style={onlyFav ? styles.starTxtOn : styles.starTxt}>★</Text>
        </Pressable>
      </View>

      {tab === 'grid' ? (
        <AllGrid
          items={filtered}
          onAddPhoto={() => setAddMenu(true)}
          onReplace={openReplaceInGrid}
          onDelete={onDelete}
          onToggleFav={toggleFav}
          onEditText={editTextItem}
        />
      ) : (
        <CompareView
          left={leftItem?.type === 'photo' ? leftItem : null}
          right={rightItem?.type === 'photo' ? rightItem : null}
          onPickLeft={openReplaceLeft}
          onPickRight={openReplaceRight}
          onShare={async () => {
            try {
              const lbl = leftItem && rightItem
                ? `${fmtDate(leftItem.createdAt)} - ${fmtDate(rightItem.createdAt)}`
                : 'Progress photos';
              await Share.share({ message: `Boost Roo — ${lbl}` });
            } catch {}
          }}
        />
      )}

      {/* меню +Фото / +Текст */}
      <AddMenu
        visible={addMenu}
        onClose={() => setAddMenu(false)}
        onAddPhoto={addFromLibrary}
        onAddText={addTextItem}
      />

      {/* выбор из существующих (только фото) */}
      <ChooseFromExisting
        visible={picker.visible}
        items={items.filter(i => i.type === 'photo')}
        disabledId={picker.mode==='grid' && typeof picker.target==='number'
          ? items[picker.target]?.id : null}
        onClose={() => setPicker({ visible: false, target: null, mode: 'grid' })}
        onPick={onPickExisting}
      />

      {/* редактор текста */}
      <TextEditor
        visible={textEditor.visible}
        value={textEditor.value}
        onChange={(v) => setTextEditor(s => ({ ...s, value: v }))}
        onCancel={() => setTextEditor({ visible: false, id: null, value: '' })}
        onSave={saveText}
      />
    </View>
  );
}

/* ---------- Sub-components ---------- */

function AllGrid({ items, onAddPhoto, onReplace, onDelete, onToggleFav, onEditText }) {
  if (!items.length) {
    return (
      <View style={styles.empty}>
        <Image source={require('../assets/roo_timer.webp')} style={{ width: 200, height: 200 }} resizeMode="contain" />
        <Text style={styles.emptyTxt}>Add photos or notes to track your journey</Text>
        <Fab onPress={onAddPhoto} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 14, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: 6, gap: 14 }}
        renderItem={({ item, index }) => (
          <LinearGradient
            colors={['rgba(44,139,255,0.55)', 'rgba(44,139,255,0.05)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.tileOuter}
          >
            <View style={styles.tileInner}>
              {item.type === 'photo' ? (
                <Pressable onPress={() => onReplace(index)} onLongPress={() => onDelete(item.id)} style={{ flex: 1 }}>
                  {item.uri ? (
                    <Image source={{ uri: item.uri }} style={styles.img} />
                  ) : (
                    <View style={[styles.img, styles.ph]}><Text style={{ color: BR.sub }}>No image</Text></View>
                  )}
                </Pressable>
              ) : (
                <Pressable onPress={() => onEditText(item.id, item.text)} onLongPress={() => onDelete(item.id)} style={styles.noteBody}>
                  <Text style={styles.noteText}>{item.text}</Text>
                </Pressable>
              )}

              {/* favorite toggle */}
              <Pressable onPress={() => onToggleFav(item.id)} style={styles.favBadge}>
                <Text style={[styles.favTxt, item.fav && styles.favTxtOn]}>★</Text>
              </Pressable>

              <View style={styles.caption}>
                <Text style={styles.captionTxt}>{fmtDate(item.createdAt)}</Text>
              </View>
            </View>
          </LinearGradient>
        )}
      />
      <Fab onPress={onAddPhoto} />
    </View>
  );
}

function CompareView({ left, right, onPickLeft, onPickRight, onShare }) {
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 8 }}>
        <LinearGradient colors={['rgba(44,139,255,0.45)', 'rgba(44,139,255,0.08)']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.boxOuter}>
          <Pressable onPress={onPickLeft} style={[styles.compareBox, left && { borderColor: BR.acc1 }]}>
            {left?.uri ? <Image source={{ uri: left.uri }} style={styles.compareImg} /> : <Placeholder />}
          </Pressable>
        </LinearGradient>

        <LinearGradient colors={['rgba(44,139,255,0.45)', 'rgba(44,139,255,0.08)']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.boxOuter}>
          <Pressable onPress={onPickRight} style={[styles.compareBox, right && { borderColor: BR.acc1 }]}>
            {right?.uri ? <Image source={{ uri: right.uri }} style={styles.compareImg} /> : <Placeholder />}
          </Pressable>
        </LinearGradient>

        <View style={styles.rangeBox}>
          <Text style={styles.rangeTxt}>
            {left && right ? `${fmtDate(left.createdAt)} - ${fmtDate(right.createdAt)}` : 'Pick two photos'}
          </Text>
        </View>

        <Pressable onPress={onShare} style={styles.shareBtn}>
          <LinearGradient colors={[BR.acc1, BR.acc2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.shareBg}>
            <Text style={styles.shareTxt}>Share</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Placeholder() {
  return (
    <View style={styles.ph}>
      <Text style={{ color: BR.sub }}>Tap to choose photo</Text>
    </View>
  );
}

function Fab({ onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.fabWrap}>
      <LinearGradient colors={[BR.acc1, BR.acc2]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.fab}>
        <Text style={{ color: '#fff', fontSize: 26, lineHeight: 26, marginTop: -2 }}>＋</Text>
      </LinearGradient>
    </Pressable>
  );
}

/* Меню: +Фото / +Текст */
function AddMenu({ visible, onClose, onAddPhoto, onAddText }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.menu} onPress={() => {}}>
          <Text style={styles.menuTitle}>Add to Gallery</Text>
          <Pressable onPress={onAddPhoto} style={styles.menuBtn}>
            <Text style={styles.menuBtnTxt}>+ Photo</Text>
          </Pressable>
          <Pressable onPress={onAddText} style={styles.menuBtn}>
            <Text style={styles.menuBtnTxt}>+ Text note</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* Редактор текста */
function TextEditor({ visible, value, onChange, onCancel, onSave }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.modalBg} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Text note</Text>
          <TextInput
            placeholder="Write something…"
            placeholderTextColor={BR.sub}
            value={value}
            onChangeText={onChange}
            style={styles.input}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Pressable onPress={onCancel} style={[styles.actionBtn, { backgroundColor: BR.chip }]}>
              <Text style={styles.actionBtnTxt}>Cancel</Text>
            </Pressable>
            <Pressable onPress={onSave} style={styles.actionBtn}>
              <LinearGradient colors={[BR.acc1, BR.acc2]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.actionGrad}>
                <Text style={styles.actionBtnTxt}>Save</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ChooseFromExisting({ visible, items, disabledId, onClose, onPick }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Select a photo</Text>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            numColumns={3}
            columnWrapperStyle={{ gap: 8 }}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const disabled = item.id === disabledId;
              return (
                <Pressable
                  disabled={disabled}
                  onPress={() => onPick(item.id)}
                  style={[styles.pickCell, disabled && { opacity: 0.35 }]}
                >
                  {item.uri ? (
                    <Image source={{ uri: item.uri }} style={{ width: '100%', height: '100%', borderRadius: 10 }} />
                  ) : (
                    <View style={[StyleSheet.absoluteFill, styles.ph]} />
                  )}
                </Pressable>
              );
            }}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------- styles ---------- */
const TILE_W = (W - 16 * 2 - 14) / 2;

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: BR.bg },
  h1:   { color: BR.text, fontSize: 28, fontWeight: '800', paddingHorizontal: 16, marginBottom: 10 },

  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 6 },

  starBtn: {
    width: 56, height: 44, borderRadius: 16,
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BR.border,
  },
  starOn: { borderColor: 'rgba(44,139,255,0.45)' },
  starBg: { ...StyleSheet.absoluteFillObject, borderRadius: 16 },
  starTxt:   { color: BR.sub, fontSize: 18, fontWeight: '800' },
  starTxtOn: { color: '#fff',  fontSize: 18, fontWeight: '800' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTxt: { color: BR.sub, textAlign: 'center', marginTop: 14 },

  /* градиентная рамка контейнера */
  tileOuter: {
    width: TILE_W,
    borderRadius: 20,
    padding: 1,
  },
  tileInner: {
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: BR.card,
    borderWidth: 1,
    borderColor: BR.border,
  },

  img: { width: TILE_W - 2, height: (TILE_W - 2) * 1.1, borderTopLeftRadius: 19, borderTopRightRadius: 19 },

  noteBody: { minHeight: (TILE_W - 2) * 1.1, padding: 14, justifyContent: 'center' },
  noteText: { color: BR.text, fontSize: 16, lineHeight: 22 },

  caption: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: BR.glass,
    borderTopWidth: 1,
    borderTopColor: BR.border,
  },
  captionTxt: { color: BR.text, fontSize: 13 },

  favBadge: {
    position: 'absolute', right: 10, top: 10,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(10,21,51,0.55)',
    borderWidth: 1, borderColor: BR.border,
    zIndex: 2,
  },
  favTxt:   { color: BR.sub, fontSize: 16, fontWeight: '900' },
  favTxtOn: { color: '#FFD86B', fontSize: 16, fontWeight: '900' },

  fabWrap: { position: 'absolute', right: 18, bottom: 110 },
  fab: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  boxOuter: { borderRadius: 20, padding: 1 },
  compareBox: {
    height: TILE_W * 1.35,
    borderRadius: 19,
    backgroundColor: BR.card,
    borderWidth: 2,
    borderColor: BR.border,
    overflow: 'hidden',
  },
  compareImg: { width: '100%', height: '100%' },

  rangeBox: {
    height: 52,
    borderRadius: 16,
    backgroundColor: BR.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BR.border,
  },
  rangeTxt: { color: BR.text, fontSize: 16 },

  shareBtn: { height: 56, borderRadius: 16, overflow: 'hidden' },
  shareBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTxt: { color: '#fff', fontSize: 18, fontWeight: '700' },

  ph: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // modal bg
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'flex-end' },

  // sheet (picker + editor)
  sheet: {
    maxHeight: '70%',
    width: '100%',
    backgroundColor: BR.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 14,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: BR.border,
  },
  sheetTitle: { color: BR.text, fontSize: 16, fontWeight: '700', marginBottom: 10, paddingHorizontal: 4 },
  pickCell: {
    width: (W - 8 * 4) / 3, height: (W - 8 * 4) / 3, borderRadius: 10, overflow: 'hidden',
    backgroundColor: BR.card,
  },

  // add menu
  menu: {
    width: '100%',
    backgroundColor: BR.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BR.border,
  },
  menuTitle: { color: BR.text, fontWeight: '800', fontSize: 16, marginBottom: 10 },
  menuBtn: {
    height: 52, borderRadius: 14, overflow: 'hidden', marginTop: 8, borderWidth: 1, borderColor: BR.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: BR.chip,
  },
  menuBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // editor
  input: {
    minHeight: 140,
    borderRadius: 14,
    padding: 12,
    backgroundColor: BR.chip,
    color: BR.text,
    borderWidth: 1,
    borderColor: BR.border,
    textAlignVertical: 'top',
  },
  actionBtn: { flex: 1, height: 50, borderRadius: 14, overflow: 'hidden' },
  actionGrad: { ...StyleSheet.absoluteFillObject, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center', lineHeight: 50 },
});
