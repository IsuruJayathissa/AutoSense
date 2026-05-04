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
  ActivityIndicator,
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

    try {
      const reply = await AssistantService.processMessage(trimmed);
      setMessages((prev) => [...prev, { id: newId(), role: 'bot', text: reply.text }]);
      setSuggestions(reply.suggestions || []);
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
          <View style={styles.userBubble}>
            <Text style={styles.userText}>{item.text}</Text>
          </View>
        </View>
      );
    }
    return (
      <View style={styles.botRow}>
        <View style={styles.botAvatar}>
          <LinearGradient
            colors={['#8B0000', '#A00000']}
            style={styles.botAvatarInner}
          >
            <Ionicons name="car-sport" size={16} color="#FFFFFF" />
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
            <View style={styles.headerAvatar}>
              <LinearGradient colors={['#8B0000', '#A00000']} style={styles.headerAvatarInner}>
                <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <View>
              <Text style={styles.headerTitle}>AutoSense Assistant</Text>
              <View style={styles.headerStatus}>
                <View style={styles.headerDot} />
                <Text style={styles.headerStatusText}>Online · Vehicle context enabled</Text>
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
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || thinking) && styles.sendBtnDisabled]}
              onPress={() => send()}
              disabled={!input.trim() || thinking}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
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
      <View style={styles.botAvatar}>
        <LinearGradient colors={['#8B0000', '#A00000']} style={styles.botAvatarInner}>
          <Ionicons name="car-sport" size={16} color="#FFFFFF" />
        </LinearGradient>
      </View>
      <View style={[styles.botBubble, styles.thinkingBubble]}>
        <ActivityIndicator size="small" color="#8B0000" />
        <Text style={styles.thinkingText}>Thinking…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerAvatar: {
    width: 36, height: 36, borderRadius: 18, overflow: 'hidden',
  },
  headerAvatarInner: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  headerStatus: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  headerStatusText: { fontSize: 10, color: '#6B7280' },

  body: { flex: 1 },
  list: { padding: 12, paddingBottom: 16 },

  // Bot message
  botRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    gap: 8, marginVertical: 6, maxWidth: '90%',
  },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15, overflow: 'hidden',
  },
  botAvatarInner: {
    width: '100%', height: '100%',
    justifyContent: 'center', alignItems: 'center',
  },
  botBubble: {
    backgroundColor: '#FFFFFF', padding: 12,
    borderRadius: 14, borderTopLeftRadius: 4,
    borderWidth: 1, borderColor: '#E5E7EB',
    maxWidth: '88%',
  },
  botText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },

  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  thinkingText: { fontSize: 13, color: '#6B7280', fontStyle: 'italic' },

  // User message
  userRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    marginVertical: 6,
  },
  userBubble: {
    backgroundColor: '#8B0000', padding: 12,
    borderRadius: 14, borderTopRightRadius: 4,
    maxWidth: '85%',
  },
  userText: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },

  // Suggestion chips
  chipsRow: {
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 8, flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1, borderColor: '#FCA5A5',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 18, marginRight: 8,
  },
  chipText: { fontSize: 12, color: '#8B0000', fontWeight: '600' },

  // Input
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  input: {
    flex: 1, backgroundColor: '#F3F4F6',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#1F2937',
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#8B0000',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#D1D5DB' },
});
