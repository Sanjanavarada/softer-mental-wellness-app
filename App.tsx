
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Animated, Image, KeyboardAvoidingView,
  Linking, Modal, Platform, Pressable, SafeAreaView,
  ScrollView, StatusBar, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import {
  AudioModule, RecordingPresets, setAudioModeAsync,
  useAudioRecorder, useAudioRecorderState, createAudioPlayer,
} from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { File, Paths } from 'expo-file-system';

type Tab = 'Home' | 'Journal' | 'Mind' | 'Listen' | 'Me';
type ThemeFamily = 'Deep' | 'Gentle' | 'Dreamy';
type JournalType = 'text' | 'voice' | 'video';

type Entry = {
  id: string;
  type: JournalType;
  text: string;
  uri?: string;
  date: string;
  trigger: string;
  mood: string;
};

const STORE_KEY = 'softer-complete-v3';

const THEMES = {
  Deep: [
    ['Black & White', '#18191D', '#303136', '#FFFFFF', '#ADAFB8'],
    ['Dark Brown', '#2A211D', '#44352E', '#FFF2E7', '#BD987E'],
    ['Charcoal', '#252934', '#3B4050', '#F9FAFF', '#B0B7CC'],
    ['Forest', '#19312A', '#304940', '#F5F8F3', '#9AB9A6'],
    ['Midnight Blue', '#18283D', '#2D4058', '#F7FAFF', '#ADC0D6'],
  ],
  Gentle: [
    ['Blush Pink', '#FBEFFA', '#FFF9FD', '#795772', '#C59AC0'],
    ['Beige', '#F8F0E8', '#FFFDF9', '#604A42', '#B18C75'],
    ['Rose', '#FCECF1', '#FFF9FB', '#755064', '#C98DA5'],
    ['Peach', '#FFF0E7', '#FFFAF6', '#755044', '#D8A085'],
    ['Powder Blue', '#EDF5FC', '#FBFDFF', '#506579', '#8AAECF'],
  ],
  Dreamy: [
    ['Lavender', '#F3EEFD', '#FCFAFF', '#5D517A', '#A993D3'],
    ['Mint', '#EAF8F1', '#FAFFFC', '#47675A', '#8EBDAB'],
    ['Lilac', '#F9EDFA', '#FEFAFF', '#745774', '#BE96C5'],
    ['Periwinkle', '#EDF0FD', '#FCFCFF', '#566084', '#96A3D6'],
    ['Buttercream', '#FFF7E4', '#FFFCF6', '#78674A', '#C3A770'],
  ],
} as const;

const MOODS = [
  { emoji: '😊', name: 'Good', message: 'There is room for joy here. You deserve the good moments too. ☀️🤍' },
  { emoji: '🥺', name: 'Emotional', message: 'Feeling deeply does not make you weak. Give yourself some tenderness. 🫂' },
  { emoji: '😟', name: 'Worried', message: 'Some situations really are uncertain. You do not have to figure everything out tonight. 🌿' },
  { emoji: '😔', name: 'Sad', message: 'You are still worthy of care on the days that feel heavy. 🤍' },
  { emoji: '😴', name: 'Tired', message: 'You are allowed to rest without needing to earn it. 🌙' },
];

const QUOTES = [
  'You deserve the same kindness you give to others. 🤍',
  'There is no deadline for becoming yourself. 🌷',
  'You are not defined by one difficult day. 🦋',
  'Some thoughts can wait until tomorrow. 🌙',
  'You do not have to carry everything alone. 🫂',
  'The younger version of you deserved love. You still do. 🧸',
];

const TRIGGERS = [
  'Not sure', 'Family', 'Relationships', 'Studies / work',
  'Future', 'Past memory', 'Self-image', 'Something else',
];

const QUESTIONS = [
  'Does the same thought keep coming back to you?',
  'Is it difficult to focus on something else?',
  'Are you imagining many possible outcomes?',
  'Does uncertainty feel especially uncomfortable right now?',
  'Is this affecting your sleep or everyday activities?',
];

const ALBUMS: Record<string, { title: string; url: string }[]> = {
  Affirmations: [
    { title: 'Affirmation 01', url: 'https://youtu.be/maNr_0zK5VQ' },
    { title: 'Affirmation 02', url: 'https://youtu.be/Ed5yqt9B9K0' },
    { title: 'Affirmation 03', url: 'https://youtu.be/hBB5rUm2jmw' },
    { title: 'Affirmation 04', url: 'https://youtu.be/2bbHZusVgw0' },
  ],
  Meditation: [
    { title: 'Meditation 01', url: 'https://youtu.be/aIIEI33EUqI' },
    { title: 'Meditation 02', url: 'https://youtu.be/YRJ6xoiRcpQ' },
    { title: 'Meditation 03', url: 'https://youtu.be/ijfLsKg8jFY' },
    { title: 'Meditation Live 04', url: 'https://www.youtube.com/live/ZiBz1AqSWs8' },
    { title: 'Meditation Live 05', url: 'https://www.youtube.com/live/Affh1xGriY8' },
  ],
  'Nature & Rain': [
    { title: 'Nature 01', url: 'https://youtu.be/c2NmyoXBXmE' },
    { title: 'Nature 02', url: 'https://youtu.be/VKSEG8Xr-RQ' },
    { title: 'Nature 03', url: 'https://youtu.be/yIQd2Ya0Ziw' },
    { title: 'Nature 04', url: 'https://youtu.be/IcEOI5gRyOc' },
    { title: 'Nature 05', url: 'https://youtu.be/hlWiI4xVXKY' },
  ],
};

const MEMORY_ICONS = ['🌷', '🦋', '🌙', '🤍'];

const EMOTION_PAIRS = [
  { question: 'A friend remembers something important to you.', answer: 'Appreciated' },
  { question: 'You are waiting for an important result.', answer: 'Uncertain' },
  { question: 'Someone listens without judging you.', answer: 'Understood' },
  { question: 'You finish something you worked hard on.', answer: 'Proud' },
];

function saveMediaFile(uri: string, extension: string) {
  const destination = new File(
    Paths.document,
    `softer-${Date.now()}-${Math.round(Math.random() * 100000)}.${extension}`
  );
  new File(uri).copy(destination);
  return destination.uri;
}

function deleteMediaFile(uri?: string) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // An unavailable local file should not crash the app.
  }
}

function VideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: 220, borderRadius: 14 }}
      nativeControls
      contentFit="contain"
    />
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Woman');
  const [family, setFamily] = useState<ThemeFamily>('Gentle');
  const [themeIndex, setThemeIndex] = useState(0);
  const [photo, setPhoto] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>('Home');
  const [popup, setPopup] = useState('');
  const [mood, setMood] = useState('');
  const [quoteIndex, setQuoteIndex] = useState(0);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [journalType, setJournalType] = useState<JournalType>('text');
  const [draft, setDraft] = useState('');
  const [trigger, setTrigger] = useState('Not sure');
  const [customTrigger, setCustomTrigger] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [recordingFile, setRecordingFile] = useState<string | null>(null);

  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);

  const [game, setGame] = useState('');
  const [petals, setPetals] = useState(0);
  const [memoryCards, setMemoryCards] = useState<number[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [emotionNumber, setEmotionNumber] = useState(0);
  const [emotionAnswer, setEmotionAnswer] = useState('');
  const [puzzle, setPuzzle] = useState<number[]>([]);

  const [assessmentAnswers, setAssessmentAnswers] = useState<(boolean | null)[]>(
    Array(5).fill(null)
  );
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [album, setAlbum] = useState('');

  const [resetting, setResetting] = useState(false);
  const savingBlocked = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const voicePlayer = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const flipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popAnimation = useRef(new Animated.Value(0.8)).current;

  const voiceRecorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    directory: 'document',
  });
  const recorderState = useAudioRecorderState(voiceRecorder);
  const [, askCamera] = useCameraPermissions();
  const [, askCameraMicrophone] = useMicrophonePermissions();

  const palette = THEMES[family][themeIndex];
  const bg = palette[1];
  const card = palette[2];
  const ink = palette[3];
  const accent = palette[4];
  const dark = family === 'Deep';

  useEffect(() => {
    async function restore() {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        if (raw) {
          const data = JSON.parse(raw);
          setStarted(!!data.started);
          setName(data.name || '');
          setAge(data.age || '');
          setGender(data.gender || 'Woman');
          setFamily(
            data.family && THEMES[data.family as ThemeFamily]
              ? data.family
              : 'Gentle'
          );
          setThemeIndex(
            Number.isInteger(data.themeIndex)
              ? Math.max(0, Math.min(4, data.themeIndex))
              : 0
          );
          setPhoto(data.photo || null);
          setEntries(Array.isArray(data.entries) ? data.entries : []);
          setMood(data.mood || '');
        }
      } catch {
        Alert.alert('Softer', 'Your previous demo settings could not be loaded.');
      } finally {
        setQuoteIndex(Math.floor(Math.random() * QUOTES.length));
        setLoading(false);
      }
    }
    restore();
    return () => {
      voicePlayer.current?.release();
      if (flipTimer.current) clearTimeout(flipTimer.current);
    };
  }, []);

  useEffect(() => {
    if (loading || savingBlocked.current) return;
    AsyncStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        started, name, age, gender, family,
        themeIndex, photo, entries, mood,
      })
    ).catch(() => {});
  }, [
    loading, started, name, age, gender,
    family, themeIndex, photo, entries, mood,
  ]);

  const text = (
    value: string,
    size = 15,
    bold = false,
    faded = false
  ) => (
    <Text
      style={{
        color: ink,
        fontSize: size,
        fontWeight: bold ? '700' : '400',
        lineHeight: size * 1.4,
        opacity: faded ? 0.7 : 1,
      }}
    >
      {value}
    </Text>
  );

  const box = (children: React.ReactNode) => (
    <View style={{
      backgroundColor: card,
      padding: 17,
      borderRadius: 23,
      marginTop: 13,
      gap: 11,
    }}>
      {children}
    </View>
  );

  const button = (
    label: string,
    action: () => void,
    secondary = false
  ) => (
    <Pressable
      onPress={action}
      style={{
        backgroundColor: secondary ? bg : accent,
        paddingVertical: 13,
        paddingHorizontal: 12,
        borderRadius: 15,
        alignItems: 'center',
      }}
    >
      <Text style={{
        color: secondary ? ink : dark ? '#1D2023' : 'white',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
      }}>
        {label}
      </Text>
    </Pressable>
  );

  const chip = (
    value: string,
    selected: boolean,
    action: () => void
  ) => (
    <Pressable
      key={value}
      onPress={action}
      style={{
        paddingHorizontal: 13,
        paddingVertical: 9,
        marginRight: 7,
        marginBottom: 7,
        borderRadius: 20,
        backgroundColor: selected ? accent : bg,
      }}
    >
      <Text style={{
        color: selected ? (dark ? '#18191D' : 'white') : ink,
        fontSize: 12,
        fontWeight: selected ? '700' : '400',
      }}>
        {value}
      </Text>
    </Pressable>
  );

  const input = (
    placeholder: string,
    value: string,
    update: (value: string) => void,
    multiline = false
  ) => (
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#9E939C"
      value={value}
      onChangeText={update}
      multiline={multiline}
      style={{
        backgroundColor: bg,
        color: ink,
        borderRadius: 13,
        padding: 13,
        fontSize: 15,
        minHeight: multiline ? 110 : 46,
        textAlignVertical: 'top',
      }}
    />
  );

  function openTab(next: Tab) {
    setGame('');
    setTab(next);
  }

  async function choosePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.75,
      });

      if (!result.canceled) {
        const newUri = saveMediaFile(result.assets[0].uri, 'jpg');
        setPhoto(previous => {
          if (previous) deleteMediaFile(previous);
          return newUri;
        });
      }
    } catch (error) {
      Alert.alert('Photograph', 'Could not select a photo. ' + String(error));
    }
  }

  function selectMood(index: number) {
    const chosen = MOODS[index];
    setMood(chosen.name);
    setPopup(chosen.message);
    popAnimation.setValue(0.65);
    Animated.spring(popAnimation, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }

  function resetDraft() {
    setDraft('');
    setTrigger('Not sure');
    setCustomTrigger('');
    setEditId(null);
    setRecordingFile(null);
  }

  function saveJournal() {
    if (journalType === 'text' && !draft.trim()) {
      Alert.alert('Journal', 'Write something first, or return when you feel ready.');
      return;
    }

    if (journalType !== 'text' && !recordingFile) {
      Alert.alert('Journal', 'Record something first.');
      return;
    }

    const resolvedTrigger =
      trigger === 'Something else'
        ? customTrigger.trim() || 'Other'
        : trigger;

    const entry: Entry = {
      id: Date.now().toString(),
      type: journalType,
      text: draft.trim(),
      uri: recordingFile || undefined,
      date: new Date().toLocaleString(),
      trigger: resolvedTrigger,
      mood: mood || 'Not selected',
    };

    if (editId) {
      setEntries(previous =>
        previous.map(item =>
          item.id === editId
            ? {
                ...item,
                text: entry.text,
                trigger: entry.trigger,
              }
            : item
        )
      );
    } else {
      setEntries(previous => [entry, ...previous]);
    }

    resetDraft();
    Alert.alert('Saved 🤍', 'Your reflection has been saved locally.');
  }

  async function startVoice() {
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Microphone', 'Please enable microphone access in Settings.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await voiceRecorder.prepareToRecordAsync();
      voiceRecorder.record();
    } catch (error) {
      Alert.alert('Voice recording', String(error));
    }
  }

  async function stopVoice() {
    try {
      await voiceRecorder.stop();
      if (voiceRecorder.uri) {
        setRecordingFile(voiceRecorder.uri);
      }
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
    } catch (error) {
      Alert.alert('Voice recording', String(error));
    }
  }

  function playVoice(uri: string) {
    try {
      voicePlayer.current?.release();
      voicePlayer.current = createAudioPlayer(uri);
      voicePlayer.current.play();
    } catch (error) {
      Alert.alert('Audio', 'Could not play this recording. ' + String(error));
    }
  }

  async function openVideoCamera() {
    const cameraPermission = await askCamera();
    const microphonePermission = await askCameraMicrophone();

    if (!cameraPermission.granted || !microphonePermission.granted) {
      Alert.alert(
        'Camera permission',
        'Please allow camera and microphone access in your phone settings.'
      );
      return;
    }

    setCameraVisible(true);
  }

  async function recordVideo() {
    if (!cameraRef.current) return;
    setCameraBusy(true);

    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: 90,
      });
      if (result?.uri) {
        const uri = saveMediaFile(result.uri, 'mp4');
        setRecordingFile(uri);
        setCameraVisible(false);
      }
    } catch (error) {
      Alert.alert('Video recording', String(error));
    } finally {
      setCameraBusy(false);
    }
  }

  function removeEntry(entry: Entry) {
    Alert.alert('Delete entry?', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setEntries(previous =>
            previous.filter(item => item.id !== entry.id)
          );
          deleteMediaFile(entry.uri);
        },
      },
    ]);
  }

  function logOut() {
    voicePlayer.current?.pause();
    setGame('');
    setAlbum('');
    setPopup('');
    resetDraft();
    setTab('Home');
    setStarted(false);
  }

  function clearAllData() {
    Alert.alert(
      'Reset Softer?',
      'Delete your test profile, photo, journal entries, and saved recordings? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear everything',
          style: 'destructive',
          onPress: async () => {
            if (resetting) return;
            setResetting(true);
            savingBlocked.current = true;
            try {
              voicePlayer.current?.pause();
              if (recorderState.isRecording) {
                await voiceRecorder.stop();
              }

              entries.forEach(item => deleteMediaFile(item.uri));
              deleteMediaFile(photo);
              if (recordingFile && !entries.some(e => e.uri === recordingFile)) {
                deleteMediaFile(recordingFile);
              }

              setStarted(false);
              setName('');
              setAge('');
              setGender('Woman');
              setFamily('Gentle');
              setThemeIndex(0);
              setPhoto(null);
              setEntries([]);
              setMood('');
              setQuoteIndex(0);
              setAssessmentAnswers(Array(5).fill(null));
              setAssessmentDone(false);
              setGame('');
              setPopup('');
              setAlbum('');
              setTab('Home');
              resetDraft();

              await AsyncStorage.setItem(
                STORE_KEY,
                JSON.stringify({
                  started: false,
                  name: '',
                  age: '',
                  gender: 'Woman',
                  family: 'Gentle',
                  themeIndex: 0,
                  photo: null,
                  entries: [],
                  mood: '',
                })
              );

              Alert.alert('Reset complete 🌷', 'You can begin again.');
            } catch (error) {
              Alert.alert('Reset issue', String(error));
            } finally {
              savingBlocked.current = false;
              setResetting(false);
            }
          },
        },
      ]
    );
  }

  function startMemoryGame() {
    const cards = [0, 0, 1, 1, 2, 2, 3, 3];
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    setMemoryCards(cards);
    setFlipped([]);
    setMatched([]);
    setGame('Memory Match');
  }

  function tapMemoryCard(index: number) {
    if (
      flipped.length === 2 ||
      flipped.includes(index) ||
      matched.includes(index)
    ) return;

    const next = [...flipped, index];
    setFlipped(next);

    if (next.length === 2) {
      if (memoryCards[next[0]] === memoryCards[next[1]]) {
        setMatched(previous => [...previous, ...next]);
        setFlipped([]);
      } else {
        flipTimer.current = setTimeout(() => setFlipped([]), 850);
      }
    }
  }

  function startNumberPuzzle() {
    let numbers = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    let blank = 8;
    let previous = -1;

    for (let step = 0; step < 80; step++) {
      const neighbors = [
        blank - 3, blank + 3,
        blank % 3 > 0 ? blank - 1 : -1,
        blank % 3 < 2 ? blank + 1 : -1,
      ].filter(i => i >= 0 && i < 9 && i !== previous);

      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      [numbers[blank], numbers[next]] = [numbers[next], numbers[blank]];
      previous = blank;
      blank = next;
    }

    setPuzzle(numbers);
    setGame('Number Puzzle');
  }

  function moveNumber(index: number) {
    const blank = puzzle.indexOf(0);
    const neighbors = [
      blank - 3, blank + 3,
      blank % 3 > 0 ? blank - 1 : -1,
      blank % 3 < 2 ? blank + 1 : -1,
    ];

    if (!neighbors.includes(index)) return;
    setPuzzle(previous => {
      const next = [...previous];
      [next[index], next[blank]] = [next[blank], next[index]];
      return next;
    });
  }

  const themePicker = (
    <>
      {text('Choose your colors 🎨', 18, true)}
      <View style={styles.wrap}>
        {(['Deep', 'Gentle', 'Dreamy'] as ThemeFamily[]).map(f =>
          chip(f, family === f, () => {
            setFamily(f);
            setThemeIndex(0);
          })
        )}
      </View>
      <View style={styles.wrap}>
        {THEMES[family].map((p, i) => (
          <Pressable
            key={p[0]}
            onPress={() => setThemeIndex(i)}
            style={{ alignItems: 'center', marginRight: 12, marginBottom: 12 }}
          >
            <View style={{
              width: 48, height: 48, borderRadius: 15,
              backgroundColor: p[1],
              borderColor: accent,
              borderWidth: i === themeIndex ? 3 : 1,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <View style={{
                width: 19, height: 19, borderRadius: 10,
                backgroundColor: p[4],
              }} />
            </View>
            {text(p[0], 10, i === themeIndex)}
          </Pressable>
        ))}
      </View>
    </>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loading}>
        <Text style={{ fontSize: 22 }}>Opening Softer... 🌷</Text>
      </SafeAreaView>
    );
  }

  const welcome = (
    <>
      <View style={{ alignItems: 'center', paddingTop: 20, gap: 5 }}>
        {text('softer.', 45, true)}
        {text('a little space for you. ♡', 17)}
      </View>

      {box(
        <>
          {text('Hello, you. 🤍', 21, true)}
          {text('What should we call you?')}
          {input('Your name', name, setName)}
          {text('Age (optional)', 13, true)}
          {input('Your age', age, setAge)}
        </>
      )}

      {box(
        <>
          {text('Tell us a little about you', 19, true)}
          <View style={styles.wrap}>
            {['Man', 'Woman'].map(g =>
              chip(g, gender === g, () => {
                setGender(g);
                setFamily(g === 'Man' ? 'Deep' : 'Gentle');
                setThemeIndex(0);
              })
            )}
          </View>
          {text(
            'This suggests a color collection. You can choose any theme regardless of gender.',
            12, false, true
          )}
        </>
      )}

      {box(themePicker)}

      {box(
        <>
          {text('A memory close to your heart 🧸', 18, true)}
          {text(
            'Choose a childhood photograph, loved one, pet, or comforting place. You can skip this.',
            13, false, true
          )}
          {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
          {button('Choose my picture', choosePhoto)}
        </>
      )}

      {button('Enter my space →', () => setStarted(true))}
      {text(
        'Softer is a self-reflection prototype, not a medical diagnosis or emergency service.',
        12, false, true
      )}
    </>
  );

  const home = (
    <>
      {text('A little space for you. 🌷', 27, true)}
      {text(
        `Hello${name ? ', ' + name : ''}. You are welcome here.`,
        14, false, true
      )}

      {box(
        <>
          {text('A MEMORY CLOSE TO YOU 🤎', 12, true)}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
            <Pressable onPress={choosePhoto}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.photo} />
              ) : (
                <View style={[
                  styles.photo,
                  { backgroundColor: bg, justifyContent: 'center', alignItems: 'center' },
                ]}>
                  {text('🧸', 35)}
                  {text('Add picture', 11)}
                </View>
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 7 }}>
              {text('Dear little me,', 20, true)}
              {text('You have always deserved gentleness. 🤍', 13)}
              {button('Write a letter 💌', () => {
                resetDraft();
                setDraft('Dear little me,\n');
                setJournalType('text');
                openTab('Journal');
              })}
            </View>
          </View>
        </>
      )}

      {box(
        <>
          {text('How is your heart feeling today?', 19, true)}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
          }}>
            {MOODS.map((item, i) => (
              <Pressable
                key={item.name}
                onPress={() => selectMood(i)}
                style={{ alignItems: 'center', padding: 5 }}
              >
                {text(item.emoji, 28)}
                {text(item.name, 10)}
              </Pressable>
            ))}
          </View>
        </>
      )}

      {box(
        <>
          {text('✨ A thought for you', 17, true)}
          {text(QUOTES[quoteIndex], 18)}
          {button('Want to talk about it? ✍️', () => {
            resetDraft();
            setJournalType('text');
            openTab('Journal');
          })}
          {button(
            'Another gentle thought ↻',
            () => setQuoteIndex(i => (i + 1) % QUOTES.length),
            true
          )}
        </>
      )}

      <View style={{ flexDirection: 'row', gap: 11, marginTop: 13 }}>
        <Pressable
          onPress={() => setGame('menu')}
          style={[styles.half, { backgroundColor: card }]}
        >
          {text('🧩', 30)}
          {text('Little escapes', 17, true)}
          {text('Play with me →', 12)}
        </Pressable>

        <Pressable
          onPress={() => openTab('Listen')}
          style={[styles.half, { backgroundColor: card }]}
        >
          {text('🎧', 30)}
          {text('Listening room', 17, true)}
          {text('Listen now →', 12)}
        </Pressable>
      </View>

      {button('I need a gentle moment 🌿', () => {
        setPopup(
          'Look around and notice five things you can see. There is no need to rush. 🤍'
        );
        popAnimation.setValue(0.8);
        Animated.spring(popAnimation, {
          toValue: 1, useNativeDriver: true,
        }).start();
      })}
    </>
  );

  const completedGame = box(
    <>
      {text('You showed up for yourself today. That matters. 🤍', 18, true)}
      {button('Back to games', () => setGame('menu'))}
    </>
  );

  let gameScreen: React.ReactNode = null;

  if (game === 'menu') {
    gameScreen = (
      <>
        {text('Little Escapes 🧩', 27, true)}
        {text('Choose a little adventure. No pressure, no timer.', 14, false, true)}

        {[
          ['🦋', 'Memory Match', 'Find four pairs of beautiful cards'],
          ['💞', 'Emotion Match', 'Explore emotions in everyday situations'],
          ['🔢', 'Number Puzzle', 'Slide the numbers into the right order'],
          ['🌷', 'Flower Garden', 'Grow a little flower'],
        ].map(([emoji, title, description]) => (
          <Pressable
            key={title}
            onPress={() => {
              if (title === 'Memory Match') startMemoryGame();
              else if (title === 'Number Puzzle') startNumberPuzzle();
              else {
                setGame(title);
                setPetals(0);
                setEmotionNumber(0);
                setEmotionAnswer('');
              }
            }}
          >
            {box(
              <>
                {text(emoji, 29)}
                {text(title, 19, true)}
                {text(description, 13, false, true)}
                {text('Play now →', 13, true)}
              </>
            )}
          </Pressable>
        ))}
        {button('Back to Home', () => setGame(''), true)}
      </>
    );
  }

  if (game === 'Memory Match') {
    gameScreen = (
      <>
        {text('Memory Match 🦋', 26, true)}
        {text('Find all four pairs. Take your time.')}

        <View style={styles.gameGrid}>
          {memoryCards.map((value, i) => (
            <Pressable
              key={i}
              onPress={() => tapMemoryCard(i)}
              style={[styles.memoryTile, { backgroundColor: card }]}
            >
              {text(
                flipped.includes(i) || matched.includes(i)
                  ? MEMORY_ICONS[value]
                  : '❔',
                28
              )}
            </Pressable>
          ))}
        </View>

        {matched.length === 8 ? completedGame : null}
        {button('Back to games', () => setGame('menu'), true)}
      </>
    );
  }

  if (game === 'Emotion Match') {
    const current = EMOTION_PAIRS[emotionNumber];

    gameScreen = (
      <>
        {text('Emotion Match 💞', 26, true)}
        {text(
          'Situations can bring up different emotions. There are no wrong feelings.',
          14
        )}

        {current ? box(
          <>
            {text(`Situation ${emotionNumber + 1} of 4`, 12, true)}
            {text(current.question, 19, true)}
            {text('Which feeling comes to mind?')}

            {['Appreciated', 'Uncertain', 'Understood', 'Proud'].map(answer =>
              button(answer, () => setEmotionAnswer(answer), emotionAnswer !== answer)
            )}

            {emotionAnswer ? (
              <>
                {text(
                  emotionAnswer === current.answer
                    ? 'That is one possible response. 🤍'
                    : 'That feeling can make sense too. Everyone experiences things differently. 🤍',
                  14
                )}
                {button('Continue →', () => {
                  setEmotionNumber(i => i + 1);
                  setEmotionAnswer('');
                })}
              </>
            ) : null}
          </>
        ) : completedGame}

        {button('Back to games', () => setGame('menu'), true)}
      </>
    );
  }

  if (game === 'Number Puzzle') {
    const solved = puzzle.join(',') === '1,2,3,4,5,6,7,8,0';

    gameScreen = (
      <>
        {text('Number Puzzle 🔢', 26, true)}
        {text('Tap the tiles next to the empty space.')}

        <View style={styles.numberGrid}>
          {puzzle.map((value, i) => (
            <Pressable
              key={i}
              onPress={() => moveNumber(i)}
              style={[
                styles.numberTile,
                { backgroundColor: value === 0 ? bg : card },
              ]}
            >
              {value ? text(String(value), 27, true) : null}
            </Pressable>
          ))}
        </View>

        {solved ? completedGame : null}
        {button('New puzzle', startNumberPuzzle, true)}
        {button('Back to games', () => setGame('menu'), true)}
      </>
    );
  }

  if (game === 'Flower Garden') {
    gameScreen = (
      <>
        {text('Flower Garden 🌷', 26, true)}
        {text('A gentle little activity, just for you.')}

        {box(
          <>
            <View style={{ alignItems: 'center', padding: 15 }}>
              {text(
                petals >= 5 ? '🌺' : petals >= 3 ? '🌷' : petals >= 1 ? '🌱' : '🌰',
                75
              )}
            </View>
            {button('Give a little care 🌱', () =>
              setPetals(i => Math.min(i + 1, 5))
            )}
          </>
        )}

        {petals >= 5 ? completedGame : null}
        {button('Back to games', () => setGame('menu'), true)}
      </>
    );
  }

  const journal = (
    <>
      {text('My Journal 💌', 27, true)}
      {text('Write, speak, or record a moment for yourself.', 14, false, true)}

      <View style={styles.wrap}>
        {([
          ['text', '✍️ Write'],
          ['voice', '🎤 Voice'],
          ['video', '📹 Video'],
        ] as [JournalType, string][]).map(([type, label]) =>
          chip(label, journalType === type, () => {
            resetDraft();
            setJournalType(type);
          })
        )}
      </View>

      {box(
        <>
          {text(
            journalType === 'text'
              ? 'What is on your heart?'
              : journalType === 'voice'
              ? 'Your voice journal 🎤'
              : 'Your video journal 📹',
            19, true
          )}

          {journalType === 'text'
            ? input('Begin whenever you are ready...', draft, setDraft, true)
            : null}

          {journalType === 'voice' ? (
            <>
              {text(
                recorderState.isRecording
                  ? '🔴 Recording your voice...'
                  : recordingFile
                  ? 'Recording ready to save 🤍'
                  : 'Tap the button when you feel ready.',
                14
              )}
              {button(
                recorderState.isRecording ? '■ Stop recording' : '● Start recording',
                recorderState.isRecording ? stopVoice : startVoice
              )}
              {recordingFile
                ? button('▶ Listen to recording', () => playVoice(recordingFile), true)
                : null}
            </>
          ) : null}

          {journalType === 'video' ? (
            <>
              {button('📹 Open camera', openVideoCamera)}
              {recordingFile ? <VideoPreview uri={recordingFile} /> : null}
            </>
          ) : null}

          {text('What triggered this feeling? (optional)', 14, true)}

          <View style={styles.wrap}>
            {TRIGGERS.map(t =>
              chip(t, trigger === t, () => setTrigger(t))
            )}
          </View>

          {trigger === 'Something else'
            ? input('Write your own trigger', customTrigger, setCustomTrigger)
            : null}

          {journalType !== 'text'
            ? input('Optional caption', draft, setDraft, true)
            : null}

          {button(editId ? 'Update entry 🤍' : 'Save reflection 🤍', saveJournal)}
        </>
      )}

      {text('My saved reflections', 21, true)}

      {entries.length === 0
        ? box(text('Nothing saved yet. There is no rush. 🌷'))
        : entries.map(entry => (
          <View key={entry.id}>
            {box(
              <>
                {text(entry.date, 12, false, true)}
                {text(
                  `${entry.type.toUpperCase()} • ${entry.mood} • ${entry.trigger}`,
                  12, false, true
                )}
                {entry.text ? text(entry.text, 15) : null}

                {entry.type === 'voice' && entry.uri
                  ? button('▶ Play voice entry', () => playVoice(entry.uri!), true)
                  : null}

                {entry.type === 'video' && entry.uri
                  ? <VideoPreview uri={entry.uri} />
                  : null}

                {entry.type === 'text'
                  ? button('Edit this entry', () => {
                    setJournalType('text');
                    setDraft(entry.text);
                    setTrigger(
                      TRIGGERS.includes(entry.trigger)
                        ? entry.trigger
                        : 'Something else'
                    );
                    setCustomTrigger(
                      TRIGGERS.includes(entry.trigger) ? '' : entry.trigger
                    );
                    setEditId(entry.id);
                  }, true)
                  : null}

                {button('Delete entry', () => removeEntry(entry), true)}
              </>
            )}
          </View>
        ))}
    </>
  );

  const yesCount = assessmentAnswers.filter(v => v === true).length;

  const assessmentMessage = yesCount >= 3
    ? 'Several of your answers suggest that your thoughts may be repeating or taking up attention right now. Sometimes real situations, uncertainty, or difficult experiences contribute to that. You deserve compassion, not judgment. 🤍'
    : 'Your answers suggest that some concerns may be present, but that does not define how you are doing. Your circumstances and feelings both deserve care. 🌷';

  const mind = (
    <>
      {text('Mind Lab 🧠', 27, true)}
      {text('A gentle self-reflection check-in, not a diagnosis.', 13, false, true)}

      {box(
        <>
          {text('Are these happening to you right now?', 19, true)}

          {QUESTIONS.map((question, index) => (
            <View key={question} style={{ gap: 8, marginVertical: 7 }}>
              {text(`${index + 1}. ${question}`, 15)}
              <View style={styles.wrap}>
                {chip('Yes', assessmentAnswers[index] === true, () => {
                  setAssessmentDone(false);
                  setAssessmentAnswers(old =>
                    old.map((v, i) => i === index ? true : v)
                  );
                })}
                {chip('No', assessmentAnswers[index] === false, () => {
                  setAssessmentDone(false);
                  setAssessmentAnswers(old =>
                    old.map((v, i) => i === index ? false : v)
                  );
                })}
              </View>
            </View>
          ))}

          {button('Complete check-in', () => {
            if (assessmentAnswers.some(v => v === null)) {
              Alert.alert('Check-in', 'Please select Yes or No for each question.');
              return;
            }
            setAssessmentDone(true);
          })}
        </>
      )}

      {assessmentDone ? box(
        <>
          {text('A little reflection for you 🤍', 19, true)}
          {text(assessmentMessage, 15)}

          {assessmentAnswers[4]
            ? text(
              'Since this may be affecting your sleep or activities, consider discussing it with a qualified mental health professional.',
              14
            )
            : null}

          {text(
            'This response uses simple rules, not AI or a validated psychological assessment.',
            12, false, true
          )}

          {button('I want to journal', () => openTab('Journal'))}
        </>
      ) : null}

      {box(
        <>
          {text('A small grounding exercise 🌿', 18, true)}
          {text(
            'Try noticing five things you can see, four things you can feel, three sounds, two smells, and one taste. Skip any part that feels uncomfortable.'
          )}
        </>
      )}
    </>
  );

  const listen = (
    <>
      {text('The Listening Room 🎧', 27, true)}
      {text(
        'A collection of gentle sounds, affirmations, and meditations.',
        14, false, true
      )}

      {album ? (
        <>
          {button('← Back to albums', () => setAlbum(''), true)}
          {text(album, 23, true)}
          {text(
            'Tap a selection to listen on YouTube.',
            13, false, true
          )}

          {ALBUMS[album].map((track, i) => (
            <View key={track.url}>
              {box(
                <>
                  {text(`🎵 ${i + 1}. ${track.title}`, 17, true)}
                  {button('▶ Listen on YouTube', () => {
                    Linking.openURL(track.url).catch(() =>
                      Alert.alert('YouTube', 'Could not open this selection.')
                    );
                  })}
                </>
              )}
            </View>
          ))}
        </>
      ) : (
        <>
          {[
            ['💗', 'Affirmations', '4 selections'],
            ['🧘', 'Meditation', '5 selections'],
            ['🌧️', 'Nature & Rain', '5 selections'],
          ].map(([emoji, title, description]) => (
            <Pressable key={title} onPress={() => setAlbum(title)}>
              {box(
                <>
                  {text(emoji, 32)}
                  {text(title, 21, true)}
                  {text(description + ' • Open album →', 13, false, true)}
                </>
              )}
            </Pressable>
          ))}
        </>
      )}
    </>
  );

  const me = (
    <>
      {text('My Space 🫶', 27, true)}
      {text('Make this space feel like yours.', 14, false, true)}

      {box(
        <>
          {text('About me', 20, true)}
          {text('Name', 13, true)}
          {input('Your name', name, setName)}
          {text('Age (optional)', 13, true)}
          {input('Your age', age, setAge)}
          {text('I identify as', 13, true)}
          <View style={styles.wrap}>
            {['Man', 'Woman'].map(g =>
              chip(g, gender === g, () => setGender(g))
            )}
          </View>
        </>
      )}

      {box(
        <>
          {text('My comforting picture 🧸', 18, true)}
          {photo ? <Image source={{ uri: photo }} style={styles.photo} /> : null}
          {button(photo ? 'Change my photo' : 'Choose a photo', choosePhoto)}
        </>
      )}

      {box(themePicker)}

      {box(
        <>
          {text('A little reminder 🤍', 18, true)}
          {text(
            'Your worth is not measured by how productive, calm, or cheerful you feel.'
          )}
        </>
      )}

      {box(
        <>
          {text('Account & Privacy 🔐', 19, true)}
          {text(
            'Log out or reset your local Softer test data.',
            13, false, true
          )}
          {button('Log Out', logOut, true)}
          {button('Clear My Data', clearAllData, true)}
        </>
      )}
    </>
  );

  const currentPage = game
    ? gameScreen
    : tab === 'Home'
    ? home
    : tab === 'Journal'
    ? journal
    : tab === 'Mind'
    ? mind
    : tab === 'Listen'
    ? listen
    : me;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 45,
            gap: 8,
          }}
        >
          {started ? currentPage : welcome}
        </ScrollView>

        {started ? (
          <View style={{
            flexDirection: 'row',
            backgroundColor: card,
            justifyContent: 'space-around',
            paddingVertical: 12,
          }}>
            {(['Home', 'Journal', 'Mind', 'Listen', 'Me'] as Tab[]).map(
              (item, index) => (
                <Pressable
                  key={item}
                  onPress={() => openTab(item)}
                  style={{ flex: 1, alignItems: 'center' }}
                >
                  {text(['⌂', '✎', '✧', '♫', '♡'][index], 23, tab === item)}
                  {text(item, 11, tab === item)}
                </Pressable>
              )
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <Modal
        visible={!!popup}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup('')}
      >
        <View style={styles.overlay}>
          <Animated.View style={{
            backgroundColor: card,
            borderRadius: 25,
            padding: 25,
            gap: 15,
            width: '100%',
            transform: [{ scale: popAnimation }],
          }}>
            <View style={{ alignItems: 'center' }}>
              {text('✨ 🌸 💗 ✨', 33)}
            </View>
            {text(popup, 19, true)}
            {button('Want to talk about it? ✍️', () => {
              setPopup('');
              resetDraft();
              setJournalType('text');
              openTab('Journal');
            })}
            {button('Not right now', () => setPopup(''), true)}
          </Animated.View>
        </View>
      </Modal>

      <Modal
        visible={cameraVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!cameraBusy) setCameraVisible(false);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#111111' }}>
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="front"
            mode="video"
            mute={false}
          />

          <View style={{ padding: 20, gap: 12 }}>
            <Pressable
              style={styles.cameraButton}
              onPress={
                cameraBusy
                  ? () => cameraRef.current?.stopRecording()
                  : recordVideo
              }
            >
              <Text style={{ fontWeight: '700', color: '#222222' }}>
                {cameraBusy
                  ? '■ Stop recording'
                  : '● Start video recording'}
              </Text>
            </Pressable>

            {!cameraBusy ? (
              <Pressable
                style={styles.cameraButton}
                onPress={() => setCameraVisible(false)}
              >
                <Text style={{ fontWeight: '700', color: '#222222' }}>
                  Cancel
                </Text>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#F8F0E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  photo: {
    width: 108,
    height: 130,
    borderRadius: 18,
  },
  half: {
    flex: 1,
    borderRadius: 20,
    padding: 16,
    gap: 7,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(20,15,20,0.55)',
    padding: 25,
  },
  gameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
  },
  memoryTile: {
    width: '21%',
    height: 77,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  numberGrid: {
    width: 270,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 20,
  },
  numberTile: {
    width: 85,
    height: 85,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraButton: {
    backgroundColor: '#F6E9E6',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
});
