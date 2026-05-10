import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AssistantService from '../services/AssistantService';

let nextId = 1;
const newId = () => `m_${Date.now()}_${nextId++}`;

export default function AssistantScreen({ navigation }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [actions, setActions] = useState([]);
  const listRef = useRef(null);

  // Send the welcome message on mount
  useEffect(() => {
    (async () => {
      const vehicle = await AssistantService.getVehicle();
      const welcome = AssistantService.getWelcome(vehicle);
      setMessages([{ id: newId(), role: 'bot', text: welcome.text }]);
      setSuggestions(welcome.suggestions || AssistantService.getInitialSuggestions());
    })();
  }, []);

  // Auto-scroll to the newest message whenever it changes
  useEffect(() => {
    if (listRef.current && messages.length > 0) {
      // Small timeout so layout settles before scrolling
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    }
  }, [messages, thinking]);

  const send = async (text) => {
    const trimmed = (text ?? input).trim();
    if (!trimmed || thinking) return;

    // Optimistic user message
    setMessages((prev) => [...prev, { id: newId(), role: 'user', text: trimmed }]);
    setInput('');
    setThinking(true);
    setSuggestions([]);
    setActions([]);

    try {
      const reply = await AssistantService.processMessage(trimmed);
      setMessages((prev) => [...prev, { id: newId(), role: 'bot', text: reply.text }]);
      setSuggestions(reply.suggestions || []);
      setActions(reply.actions || []);
    } catch (e) {
      setMessages((prev) => [...prev, { id: newId(), role: 'bot', text: `Sorry — something went wrong: ${e.message}` }]);
    } finally {
      setThinking(false);
    }
  };

  const renderMessage = ({ item }) => {
    if (item.role === 'user') {
      return (
        <View style={styles.userRow}>
          <LinearGradient
            colors={['#8B0000', '#A00000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.userBubble}
          >
            <Text style={styles.userText}>{item.text}</Text>
          </LinearGradient>
        </View>
      );
    }
    return (
      <View style={styles.botRow}>
        <View style={styles.botAvatarRing}>
          <LinearGradient
            colors={['#8B0000', '#A00000']}
            style={styles.botAvatarInner}
          >
            <Ionicons name="sparkles" size={14} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <View style={styles.botBubble}>
          <Text style={styles.botText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.headerAvatarRing}>
              <LinearGradient
                colors={['#8B0000', '#A00000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerAvatarInner}
              >
                <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>AutoSense Assistant</Text>
              <View style={styles.headerStatus}>
                <View style={styles.headerDotPulse}>
                  <View style={styles.headerDot} />
                </View>
                <Text style={styles.headerStatusText}>AI · Vehicle context enabled</Text>
              </View>
            </View>
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.body}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
        >
          {/* Message list */}
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListFooterComponent={thinking ? <ThinkingBubble /> : null}
          />

          {/* Action chips — clickable, jump to a specific app screen */}
          {actions.length > 0 && !thinking && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {actions.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.actionChip}
                  onPress={() => navigation.navigate(a.screen)}
                  activeOpacity={0.8}
                >
                  {a.icon && (
                    <Ionicons name={a.icon} size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.actionChipText}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Quick suggestion chips */}
          {suggestions.length > 0 && !thinking && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {suggestions.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.chip}
                  onPress={() => send(s)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.chipText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={input}
                onChangeText={setInput}
                placeholder="Ask about your car…"
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={() => send()}
                returnKeyType="send"
                editable={!thinking}
                multiline
              />
            </View>
            <TouchableOpacity
              onPress={() => send()}
              disabled={!input.trim() || thinking}
              activeOpacity={0.85}
              style={styles.sendBtnWrap}
            >
              {(!input.trim() || thinking) ? (
                <View style={[styles.sendBtn, styles.sendBtnDisabled]}>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </View>
              ) : (
                <LinearGradient
                  colors={['#A00000', '#8B0000']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sendBtn}
                >
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function ThinkingBubble() {
  return (
    <View style={styles.botRow}>
      <View style={styles.botAvatarRing}>
        <LinearGradient colors={['#8B0000', '#A00000']} style={styles.botAvatarInner}>
          <Ionicons name="sparkles" size={14} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <View style={[styles.botBubble, styles.thinkingBubble]}>
        <View style={styles.typingDots}>
          <View style={[styles.typingDot, { opacity: 0.35 }]} />
          <View style={[styles.typingDot, { opacity: 0.6 }]} />
          <View style={[styles.typingDot, { opacity: 1 }]} />
        </View>
        <Text style={styles.thinkingText}>Thinking</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  safe: { flex: 1 },

  // ── Header ───────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginLeft: 10 },
  headerAvatarRing: {
    width: 44, height: 44, borderRadius: 22,
    padding: 2.5,
    backgroundColor: '#FECACA',
    justifyContent: 'center', alignItems: 'center',
  },
  headerAvatarInner: {
    width: '100%', height: '100%',
    borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', letterSpacing: -0.2 },
  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  headerDotPulse: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#10B98133',
    justifyContent: 'center', alignItems: 'center',
  },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  headerStatusText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  body: { flex: 1 },
  list: { padding: 14, paddingBottom: 18 },

  // ── Bot message ──────────────────────────────────────────────────────
  botRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 8, marginVertical: 6, maxWidth: '90%',
  },
  botAvatarRing: {
    width: 32, height: 32, borderRadius: 16,
    padding: 2,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center', alignItems: 'center',
  },
  botAvatarInner: {
    width: '100%', height: '100%',
    borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 18, borderTopLeftRadius: 4,
    borderWidth: 1, borderColor: '#F0F0F2',
    maxWidth: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  botText: { fontSize: 14.5, color: '#1F2937', lineHeight: 21 },

  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingDots: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  typingDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: '#8B0000',
  },
  thinkingText: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  // ── User message ─────────────────────────────────────────────────────
  userRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginVertical: 6,
  },
  userBubble: {
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 18, borderTopRightRadius: 4,
    maxWidth: '85%',
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  userText: { fontSize: 14.5, color: '#FFFFFF', lineHeight: 21, fontWeight: '500' },

  // ── Chip rows ────────────────────────────────────────────────────────
  chipsRow: {
    paddingHorizontal: 12, paddingVertical: 8,
    gap: 8, flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#FECACA',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, marginRight: 8,
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  chipText: { fontSize: 12.5, color: '#8B0000', fontWeight: '600' },

  actionChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#8B0000',
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, marginRight: 8,
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  actionChipText: { fontSize: 12.5, color: '#FFFFFF', fontWeight: '700' },

  // ── Input ────────────────────────────────────────────────────────────
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F0F0F2',
  },
  inputWrap: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 22,
    borderWidth: 1, borderColor: '#E5E7EB',
    paddingHorizontal: 4,
  },
  input: {
    fontSize: 14.5, color: '#1F2937',
    paddingHorizontal: 14, paddingVertical: 11,
    maxHeight: 110,
  },
  sendBtnWrap: {
    shadowColor: '#8B0000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
});
