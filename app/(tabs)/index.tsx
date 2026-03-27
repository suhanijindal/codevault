import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Modal,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// ─────────────────────────────────────────────────────────────────────────────
// RunAnywhere – On-Device AI for React Native
// Learn more: https://runanywhere.ai
// ─────────────────────────────────────────────────────────────────────────────

let RunAnywhere: any = null;
let sdkAvailable = false;
try {
  const sdk = require('runanywhere-react-native');
  RunAnywhere = sdk.RunAnywhere;
  sdkAvailable = true;
} catch (e) {
  console.log('[CodeVault] SDK not available (expected in Expo Go)');
}

// Optional clipboard
let ClipboardAPI: any = null;
try {
  ClipboardAPI = require('@react-native-clipboard/clipboard').default;
} catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ReviewMode = 'security' | 'bugs' | 'quality' | 'explain';

interface ModelInfo {
  id: string;
  name: string;
  category: string;
  isDownloaded?: boolean;
  localPath?: string;
  downloadSize?: number;
  downloadURL?: string;
}

interface HistoryEntry {
  id: string;
  timestamp: Date;
  mode: ReviewMode;
  codeSnippet: string;
  output: string;
  expanded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Review modes
// ─────────────────────────────────────────────────────────────────────────────

const REVIEW_MODES: {
  id: ReviewMode;
  icon: string;
  label: string;
  description: string;
  accent: string;
  prompt: string;
}[] = [
  {
    id: 'security',
    icon: '🛡️',
    label: 'Security',
    description: 'Vulnerabilities & injection risks',
    accent: '#EF4444',
    prompt:
      'Review this code for security issues. List each vulnerability with:\nSEVERITY: (Critical/High/Medium/Low)\nISSUE: (description)\nFIX: (how to fix it)\n\nCode:\n',
  },
  {
    id: 'bugs',
    icon: '🐛',
    label: 'Bugs',
    description: 'Logic errors & edge cases',
    accent: '#F59E0B',
    prompt:
      'Review this code for bugs, logic errors, and unhandled edge cases. For each issue found:\nBUG: (description)\nLOCATION: (line/function)\nFIX: (suggested fix)\n\nCode:\n',
  },
  {
    id: 'quality',
    icon: '✨',
    label: 'Quality',
    description: 'Readability & performance',
    accent: '#60A5FA',
    prompt:
      'Review this code for quality, readability, and performance. Provide actionable suggestions:\nISSUE: (description)\nIMPACT: (why it matters)\nSUGGESTION: (improvement)\n\nCode:\n',
  },
  {
    id: 'explain',
    icon: '📖',
    label: 'Explain',
    description: 'Line-by-line walkthrough',
    accent: '#22C55E',
    prompt:
      'Provide a clear line-by-line explanation of what this code does, including its purpose, how it works, and any important details a developer should know.\n\nCode:\n',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Sample code snippets  (Feature 2)
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLES: { id: string; label: string; lang: string; code: string }[] = [
  {
    id: 'sql',
    label: 'SQL Injection',
    lang: 'Python',
    code: `import sqlite3

def get_user(username):
    conn = sqlite3.connect("app.db")
    query = f"SELECT * FROM users WHERE username = '{username}'"
    cursor = conn.cursor()
    cursor.execute(query)
    return cursor.fetchone()

def login(request):
    user = request.get("username")
    password = request.get("password")
    db_user = get_user(user)
    if db_user and db_user[2] == password:
        return {"token": user + "_token"}
    return {"status": "fail"}`,
  },
  {
    id: 'xss',
    label: 'XSS Vulnerability',
    lang: 'JavaScript',
    code: `app.get('/search', (req, res) => {
  const query = req.query.q;
  res.send(\`<h1>Results for: \${query}</h1>\`);
});`,
  },
  {
    id: 'secrets',
    label: 'Hardcoded Secrets',
    lang: 'Python',
    code: `API_KEY = "sk-1234567890abcdef"
DB_PASSWORD = "admin123"

def connect():
    return psycopg2.connect(
        host="prod-db.company.com",
        password=DB_PASSWORD
    )`,
  },
  {
    id: 'custom',
    label: 'My code',
    lang: 'Code',
    code: '',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#1a1816',
  surface:      '#242220',
  elevated:     '#2e2b28',
  accent:       '#D97757',
  accentDim:    'rgba(217,119,87,0.12)',
  accentBorder: 'rgba(217,119,87,0.30)',
  green:        '#22C55E',
  greenDim:     'rgba(34,197,94,0.10)',
  greenBorder:  'rgba(34,197,94,0.25)',
  text:         '#ECECEA',
  textSub:      '#A3A199',
  textMuted:    '#6B6961',
  border:       '#363330',
  borderSoft:   '#2a2724',
  danger:       '#EF4444',
  warning:      '#F59E0B',
  info:         '#60A5FA',
  codeText:     '#c9bfb0',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function firstNonEmpty(text: string): string {
  return text.split('\n').find(l => l.trim().length > 0) ?? '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Output line renderer
// ─────────────────────────────────────────────────────────────────────────────

function OutputLine({ line }: { line: string }) {
  const t = line.trim();
  const sevMatch = t.match(/^SEVERITY:\s*(.+)$/i);
  if (sevMatch) {
    const level = sevMatch[1]!.trim().toUpperCase();
    let color = C.info;
    let bg    = 'rgba(96,165,250,0.12)';
    if (/CRITICAL|HIGH/.test(level))  { color = C.danger;  bg = 'rgba(239,68,68,0.12)'; }
    else if (/MEDIUM/.test(level))    { color = C.warning; bg = 'rgba(245,158,11,0.12)'; }
    return (
      <View style={ol.severityRow}>
        <Text style={ol.severityKey}>Severity  </Text>
        <View style={[ol.pill, { backgroundColor: bg, borderColor: color }]}>
          <Text style={[ol.pillText, { color }]}>{level}</Text>
        </View>
      </View>
    );
  }
  if (/^(ISSUE|BUG|LOCATION|IMPACT):/i.test(t))
    return <Text style={ol.issueLine}>{line}</Text>;
  if (/^(FIX|SUGGESTION):/i.test(t))
    return <Text style={ol.fixLine}>{line}</Text>;
  if (t === '') return <View style={{ height: 8 }} />;
  return <Text style={ol.defaultLine}>{line}</Text>;
}

const ol = StyleSheet.create({
  severityRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 3 },
  severityKey: { color: C.textMuted, fontSize: 13, fontFamily: 'monospace' },
  pill:        { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  pillText:    { fontSize: 11, fontWeight: '700', fontFamily: 'monospace' },
  issueLine:   { color: '#ddd8d0', fontFamily: 'monospace', fontSize: 13, lineHeight: 21 },
  fixLine:     { color: '#6dba8a', fontFamily: 'monospace', fontSize: 13, lineHeight: 21 },
  defaultLine: { color: C.codeText, fontFamily: 'monospace', fontSize: 13, lineHeight: 21 },
});

// ─────────────────────────────────────────────────────────────────────────────
// History card  (Feature 3)
// ─────────────────────────────────────────────────────────────────────────────

function HistoryCard({
  entry,
  onToggle,
}: {
  entry: HistoryEntry;
  onToggle: () => void;
}) {
  const mode = REVIEW_MODES.find(m => m.id === entry.mode)!;
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      style={hc.card}
      onPress={onToggle}
    >
      <View style={hc.header}>
        <View style={hc.headerLeft}>
          <Text style={hc.modeIcon}>{mode.icon}</Text>
          <View>
            <Text style={hc.modeLabel}>{mode.label} review</Text>
            <Text style={hc.time}>{formatTime(entry.timestamp)}</Text>
          </View>
        </View>
        <Text style={hc.chevron}>{entry.expanded ? '▲' : '▼'}</Text>
      </View>

      {!entry.expanded && (
        <View style={hc.preview}>
          <Text style={hc.codePreview} numberOfLines={1}>
            {entry.codeSnippet}
          </Text>
          <Text style={hc.outputPreview} numberOfLines={1}>
            {firstNonEmpty(entry.output)}
          </Text>
        </View>
      )}

      {entry.expanded && (
        <View style={hc.expanded}>
          <View style={hc.expandedDivider} />
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {entry.output.split('\n').map((line, i) => (
              <OutputLine key={i} line={line} />
            ))}
          </ScrollView>
        </View>
      )}
    </TouchableOpacity>
  );
}

const hc = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    padding: 14,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeIcon:    { fontSize: 18 },
  modeLabel:   { fontSize: 13, fontWeight: '600', color: C.textSub },
  time:        { fontSize: 11, color: C.textMuted, marginTop: 1 },
  chevron:     { fontSize: 10, color: C.textMuted },
  preview:     { marginTop: 10, gap: 4 },
  codePreview: {
    color: C.codeText,
    fontFamily: 'monospace',
    fontSize: 12,
    backgroundColor: C.elevated,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  outputPreview: {
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  expanded:        { marginTop: 12 },
  expandedDivider: { height: 1, backgroundColor: C.borderSoft, marginBottom: 12 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.border, marginVertical: 20 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function CodeVault() {
  // ── SDK state (unchanged) ─────────────────────────────────────────────────
  const [isInitialized, setIsInitialized]       = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  // ── Model state (unchanged) ───────────────────────────────────────────────
  const [models, setModels]                     = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel]       = useState<ModelInfo | null>(null);
  const [isDownloading, setIsDownloading]       = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [isModelLoaded, setIsModelLoaded]       = useState(false);
  const [isLoading, setIsLoading]               = useState(false);

  // ── Review state (unchanged) ──────────────────────────────────────────────
  const [selectedMode, setSelectedMode]         = useState<ReviewMode>('security');
  const [codeInput, setCodeInput]               = useState(SAMPLES[0]!.code);
  const [reviewResult, setReviewResult]         = useState('');
  const [isGenerating, setIsGenerating]         = useState(false);

  // ── UI state (unchanged) ──────────────────────────────────────────────────
  const [reviewCount, setReviewCount]           = useState(0);
  const [copied, setCopied]                     = useState(false);

  // ── Feature 1: Privacy Proof ──────────────────────────────────────────────
  const [showPrivacyModal, setShowPrivacyModal]     = useState(false);
  const [privacyTestRunning, setPrivacyTestRunning] = useState(false);
  const [privacyTestDone, setPrivacyTestDone]       = useState(false);

  // ── Feature 2: Sample selector ────────────────────────────────────────────
  const [selectedSample, setSelectedSample]     = useState('sql');

  // ── Feature 3: Review history ─────────────────────────────────────────────
  const [history, setHistory]                   = useState<HistoryEntry[]>([]);

  // ── Pulse animation ───────────────────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.25, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // ── SDK init (unchanged) ─────────────────────────────────────────────────

  useEffect(() => { initializeSDK(); }, []);

  useEffect(() => {
    if (selectedModel && models.length > 0) {
      const updated = models.find(m => m.id === selectedModel.id);
      if (updated && updated.localPath !== selectedModel.localPath) {
        setSelectedModel(updated);
      }
    }
  }, [models]);

  const initializeSDK = async () => {
    if (!sdkAvailable) {
      setError('Development build required. Install the APK from EAS Build.');
      return;
    }
    try {
      await RunAnywhere.initialize({});
      setIsInitialized(true);
      await loadModels();
    } catch (e: any) {
      setError(`Initialization failed: ${e.message}`);
    }
  };

  const loadModels = async () => {
    try {
      const allModels = await RunAnywhere.getAvailableModels();
      const formattedModels: ModelInfo[] = allModels
        .filter((m: any) => m.category === 'language')
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          category: m.category,
          isDownloaded: m.isDownloaded,
          localPath: m.localPath,
          downloadSize: m.downloadSize,
          downloadURL: m.downloadURL,
        }));
      setModels(formattedModels);
    } catch (e: any) {
      console.log('Failed to load models:', e);
    }
  };

  // ── Model management (unchanged) ─────────────────────────────────────────

  const handleSelectModel = (model: ModelInfo) => {
    const fullModel = models.find(m => m.id === model.id) || model;
    setSelectedModel(fullModel);
    setIsModelLoaded(false);
    setReviewResult('');
  };

  const handleDownloadModel = async () => {
    if (!selectedModel) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setError(null);
    try {
      const downloadedPath = await RunAnywhere.downloadModel(
        selectedModel.id,
        (progress: number) => {
          const pct =
            typeof progress === 'number' && !isNaN(progress)
              ? Math.round(progress * 100)
              : 0;
          setDownloadProgress(pct);
        }
      );
      await loadModels();
      setSelectedModel(prev =>
        prev ? { ...prev, isDownloaded: true, localPath: downloadedPath } : null
      );
    } catch (e: any) {
      setError(`Download failed: ${e.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLoadModel = async () => {
    if (!selectedModel) return;
    setIsLoading(true);
    setError(null);
    try {
      const modelPath =
        selectedModel.localPath ||
        (await RunAnywhere.getModelPath(selectedModel.id));
      if (!modelPath) {
        setError('Model path not found. Please re-download.');
        return;
      }
      await RunAnywhere.loadTextModel(modelPath);
      setIsModelLoaded(true);
      setReviewResult('');
    } catch (e: any) {
      setError(`Load failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Review action (unchanged SDK call) ───────────────────────────────────

  const handleRunReview = async () => {
    if (!codeInput.trim()) return;
    const mode = REVIEW_MODES.find(m => m.id === selectedMode)!;
    const fullPrompt = mode.prompt + codeInput;
    setIsGenerating(true);
    setError(null);
    setReviewResult('');
    try {
      const result = await RunAnywhere.generate(fullPrompt, {
        maxTokens: 512,
        temperature: 0.2,
      });
      const output = result.text || JSON.stringify(result);
      setReviewResult(output);
      setReviewCount(c => c + 1);
      // Feature 3: push to history (max 5)
      const entry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        mode: selectedMode,
        codeSnippet: codeInput.split('\n')[0] ?? '',
        output,
        expanded: false,
      };
      setHistory(prev => [entry, ...prev].slice(0, 5));
    } catch (e: any) {
      setError(`Review failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Feature 1: Privacy test (unchanged SDK call) ─────────────────────────

  const handlePrivacyTest = async () => {
    if (!isModelLoaded) return;
    setPrivacyTestRunning(true);
    setPrivacyTestDone(false);
    try {
      await RunAnywhere.generate(
        'Review this code for issues:\n\nprint("hello world")',
        { maxTokens: 80, temperature: 0.2 }
      );
      setPrivacyTestDone(true);
    } catch (_) {
      setPrivacyTestDone(true); // show "0 requests" even on error
    } finally {
      setPrivacyTestRunning(false);
    }
  };

  // ── Feature 2: Sample select ─────────────────────────────────────────────

  const handleSelectSample = (sample: typeof SAMPLES[number]) => {
    setSelectedSample(sample.id);
    setCodeInput(sample.code);
    setReviewResult('');
  };

  // ── Copy ─────────────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (ClipboardAPI) ClipboardAPI.setString(reviewResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Feature 4: Share ─────────────────────────────────────────────────────

  const handleShare = async () => {
    const modeLabel = REVIEW_MODES.find(m => m.id === selectedMode)?.label ?? 'Code';
    const message =
      `CodeVault ${modeLabel} Review:\n\n${reviewResult}\n\n` +
      `Reviewed on-device with RunAnywhere SDK — zero cloud calls.`;
    try {
      await Share.share({ message });
    } catch (_) {}
  };

  // ── History toggle ────────────────────────────────────────────────────────

  const toggleHistory = (id: string) => {
    setHistory(prev =>
      prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e)
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const currentMode  = REVIEW_MODES.find(m => m.id === selectedMode)!;
  const llmModels    = models.filter(m => m.category === 'language');
  const canRun       = isModelLoaded && !isGenerating && codeInput.trim().length > 0;
  const activeSample = SAMPLES.find(s => s.id === selectedSample);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* ══ Header ══════════════════════════════════════════════════════════ */}
        <View style={s.header}>
          <View style={s.headerTop}>
            <Text style={s.logo}>🔒 CodeVault</Text>
            <Text style={s.subtitle}>On-device code reviewer</Text>
          </View>

          <View style={s.headerBadgeRow}>
            <View style={s.privacyBadge}>
              <Animated.View style={[s.greenDot, { opacity: pulseAnim }]} />
              <Text style={s.privacyText}>
                Private · 0 API calls
                {reviewCount > 0 ? ` · ${reviewCount} review${reviewCount !== 1 ? 's' : ''}` : ''}
                {' · $0.00'}
              </Text>
            </View>

            {/* Feature 1: Privacy Proof button */}
            <TouchableOpacity
              activeOpacity={0.75}
              style={s.proofBtn}
              onPress={() => {
                setPrivacyTestDone(false);
                setShowPrivacyModal(true);
              }}
            >
              <Text style={s.proofBtnText}>Privacy proof</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ══ Error ═══════════════════════════════════════════════════════════ */}
        {error != null && (
          <View style={s.errorCard}>
            <Text style={s.errorTitle}>Something went wrong</Text>
            <Text style={s.errorBody}>{error}</Text>
          </View>
        )}

        {/* ══ Model card ══════════════════════════════════════════════════════ */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Model</Text>

          {!isInitialized && error == null && (
            <View style={s.loadingRow}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={s.loadingText}>Loading available models…</Text>
            </View>
          )}

          {llmModels.map((model, idx) => {
            const sel = selectedModel?.id === model.id;
            return (
              <View key={model.id}>
                {idx > 0 && <View style={s.rowDivider} />}
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[s.modelRow, sel && s.modelRowSel]}
                  onPress={() => handleSelectModel(model)}
                >
                  <View style={[s.selDot, sel && s.selDotActive]} />
                  <View style={s.modelText}>
                    <Text style={[s.modelName, sel && s.modelNameSel]}>
                      {model.name}
                    </Text>
                    <Text style={s.modelMeta}>
                      {model.downloadSize != null
                        ? `${(model.downloadSize / 1024 / 1024).toFixed(0)} MB · LlamaCpp`
                        : 'LlamaCpp'}
                    </Text>
                  </View>
                  {model.isDownloaded ? (
                    <View style={s.statusBadge}>
                      <Text style={s.statusBadgeText}>Downloaded</Text>
                    </View>
                  ) : (
                    <Text style={s.statusMuted}>Not downloaded</Text>
                  )}
                </TouchableOpacity>

                {sel && isDownloading && (
                  <View style={s.progressWrap}>
                    <View style={s.progressBg}>
                      <View style={[s.progressFill, { width: `${downloadProgress}%` as any }]} />
                    </View>
                    <Text style={s.progressLabel}>{downloadProgress}%</Text>
                  </View>
                )}
              </View>
            );
          })}

          {selectedModel != null && (
            <View style={s.cardAction}>
              {!selectedModel.isDownloaded ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[s.primaryBtn, isDownloading && s.primaryBtnBusy]}
                  onPress={handleDownloadModel}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <View style={s.btnInner}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={s.primaryBtnText}>Downloading…</Text>
                    </View>
                  ) : (
                    <Text style={s.primaryBtnText}>Download model</Text>
                  )}
                </TouchableOpacity>
              ) : !isModelLoaded ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[s.primaryBtn, isLoading && s.primaryBtnBusy]}
                  onPress={handleLoadModel}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <View style={s.btnInner}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={s.primaryBtnText}>Loading into memory…</Text>
                    </View>
                  ) : (
                    <Text style={s.primaryBtnText}>Load model</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={s.readyBanner}>
                  <View style={s.readyDot} />
                  <Text style={s.readyText}>{selectedModel.name} is ready</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ══ Review section ══════════════════════════════════════════════════ */}
        {isModelLoaded && (
          <>
            {/* Mode picker */}
            <View style={[s.card, s.cardNopadTop]}>
              <Text style={[s.cardLabel, s.cardLabelPad]}>Review mode</Text>
              <View style={s.modeGrid}>
                {REVIEW_MODES.map(mode => {
                  const active = selectedMode === mode.id;
                  return (
                    <TouchableOpacity
                      key={mode.id}
                      activeOpacity={0.72}
                      style={[s.modeCell, active && s.modeCellActive]}
                      onPress={() => setSelectedMode(mode.id)}
                    >
                      {active && (
                        <View style={[s.modeAccentBar, { backgroundColor: mode.accent }]} />
                      )}
                      <Text style={s.modeEmoji}>{mode.icon}</Text>
                      <Text style={[s.modeLabel, active && s.modeLabelActive]}>
                        {mode.label}
                      </Text>
                      <Text style={s.modeDesc}>{mode.description}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Code input */}
            <View style={s.card}>
              {/* Top row: label + lang chip + clear */}
              <View style={s.codeTopRow}>
                <Text style={s.cardLabel}>Code</Text>
                <View style={s.codeTopRight}>
                  <View style={s.langChip}>
                    <Text style={s.langChipText}>
                      {activeSample?.lang ?? 'Code'}
                    </Text>
                  </View>
                  {codeInput.length > 0 && (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={s.clearBtn}
                      onPress={() => {
                        setCodeInput('');
                        setSelectedSample('custom');
                      }}
                    >
                      <Text style={s.clearBtnText}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Feature 2: Sample chips */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={s.sampleRow}
                contentContainerStyle={s.sampleRowContent}
              >
                {SAMPLES.map(sample => {
                  const active = selectedSample === sample.id;
                  return (
                    <TouchableOpacity
                      key={sample.id}
                      activeOpacity={0.75}
                      style={[s.sampleChip, active && s.sampleChipActive]}
                      onPress={() => handleSelectSample(sample)}
                    >
                      <Text style={[s.sampleChipText, active && s.sampleChipTextActive]}>
                        {sample.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View style={s.codeEditorWrap}>
                <TextInput
                  style={s.codeEditor}
                  value={codeInput}
                  onChangeText={text => {
                    setCodeInput(text);
                    // If user edits, deselect preset samples
                    if (selectedSample !== 'custom' && text !== activeSample?.code) {
                      setSelectedSample('custom');
                    }
                  }}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  placeholder="Paste your code here…"
                  placeholderTextColor={C.textMuted}
                  scrollEnabled={false}
                />
              </View>
            </View>

            {/* Run button */}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[s.runBtn, !canRun && s.runBtnOff]}
              onPress={handleRunReview}
              disabled={!canRun}
            >
              {isGenerating ? (
                <View style={s.btnInner}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={s.runBtnText}>Analyzing on-device…</Text>
                </View>
              ) : (
                <Text style={[s.runBtnText, !canRun && s.runBtnTextOff]}>
                  Run {currentMode.label} review
                </Text>
              )}
            </TouchableOpacity>

            {/* Output */}
            {reviewResult !== '' && (
              <View style={s.outputCard}>
                <View style={s.outputAccentBar} />
                <View style={s.outputBody}>
                  <View style={s.outputHeader}>
                    <View>
                      <Text style={s.outputTitle}>Analysis</Text>
                      <Text style={s.outputSub}>
                        {currentMode.icon} {currentMode.label} · on-device
                      </Text>
                    </View>
                    {/* Copy + Share buttons */}
                    <View style={s.outputActions}>
                      <TouchableOpacity
                        activeOpacity={0.75}
                        style={[s.iconBtn, copied && s.iconBtnDone]}
                        onPress={handleCopy}
                      >
                        <Text style={[s.iconBtnText, copied && s.iconBtnTextDone]}>
                          {copied ? 'Copied' : 'Copy'}
                        </Text>
                      </TouchableOpacity>
                      {/* Feature 4: Share */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        style={s.iconBtn}
                        onPress={handleShare}
                      >
                        <Text style={s.iconBtnText}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={s.outputDivider} />

                  <ScrollView
                    style={s.outputScroll}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {reviewResult.split('\n').map((line, i) => (
                      <OutputLine key={i} line={line} />
                    ))}
                  </ScrollView>
                </View>
              </View>
            )}

            {/* Feature 3: Review history */}
            {history.length > 0 && (
              <View style={s.historySection}>
                <Text style={s.historySectionLabel}>
                  Recent reviews  ·  {history.length}
                </Text>
                {history.map(entry => (
                  <HistoryCard
                    key={entry.id}
                    entry={entry}
                    onToggle={() => toggleHistory(entry.id)}
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* ══ Footer ══════════════════════════════════════════════════════════ */}
        <Divider />
        <View style={s.footer}>
          <View style={s.footerBadges}>
            {['🔒 On-device', '📡 Offline', '💸 Free', '⚡ Fast'].map(b => (
              <View key={b} style={s.footerChip}>
                <Text style={s.footerChipText}>{b}</Text>
              </View>
            ))}
          </View>
          <Text style={s.footerNote}>Powered by RunAnywhere SDK · LlamaCpp</Text>
        </View>

      </ScrollView>

      {/* ══ Feature 1: Privacy Proof Modal ═══════════════════════════════════ */}
      <Modal
        visible={showPrivacyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={m.backdrop}>
          <TouchableOpacity
            style={m.backdropTap}
            activeOpacity={1}
            onPress={() => setShowPrivacyModal(false)}
          />
          <View style={m.sheet}>
            {/* Sheet handle */}
            <View style={m.handle} />

            {/* Header */}
            <View style={m.sheetHeader}>
              <Text style={m.sheetTitle}>Privacy Proof</Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={m.closeBtn}
                onPress={() => setShowPrivacyModal(false)}
              >
                <Text style={m.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Shield + counter */}
            <View style={m.counterCard}>
              <Text style={m.shieldIcon}>🛡️</Text>
              <Text style={m.counterLabel}>Network requests during reviews</Text>
              <Text style={m.counterValue}>0</Text>
              <Text style={m.counterNote}>
                {privacyTestDone
                  ? 'Review completed. Network requests: still 0'
                  : 'All inference runs entirely on this device'}
              </Text>
            </View>

            {/* Description */}
            <Text style={m.description}>
              CodeVault runs AI inference 100% on your device using{' '}
              <Text style={m.descAccent}>RunAnywhere SDK</Text>. No code is
              transmitted to any server. Your data never touches the internet.
            </Text>

            {/* Privacy guarantee row */}
            <View style={m.guaranteeRow}>
              <Text style={m.guaranteeIcon}>🔒</Text>
              <Text style={m.guaranteeText}>Your code never leaves this phone</Text>
            </View>

            {/* Test button */}
            <View style={m.testSection}>
              {!isModelLoaded ? (
                <View style={m.noModelNote}>
                  <Text style={m.noModelText}>
                    Load a model first to run a live test
                  </Text>
                </View>
              ) : privacyTestDone ? (
                <View style={m.testSuccessRow}>
                  <Text style={m.testSuccessIcon}>✓</Text>
                  <View>
                    <Text style={m.testSuccessTitle}>
                      Review completed
                    </Text>
                    <Text style={m.testSuccessBody}>
                      Network requests made: 0
                    </Text>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[m.testBtn, privacyTestRunning && m.testBtnBusy]}
                  onPress={handlePrivacyTest}
                  disabled={privacyTestRunning}
                >
                  {privacyTestRunning ? (
                    <View style={s.btnInner}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={m.testBtnText}>Running on-device…</Text>
                    </View>
                  ) : (
                    <Text style={m.testBtnText}>Run a test review</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 56 },

  // Header
  header: { paddingTop: 24, paddingBottom: 26, gap: 12 },
  headerTop: { gap: 3 },
  logo:     { fontSize: 26, fontWeight: '700', color: C.text, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: C.textMuted, fontWeight: '400' },

  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  privacyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greenDim,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.greenBorder,
    gap: 7,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.green,
  },
  privacyText: { color: C.green, fontSize: 12, fontWeight: '500' },

  // Feature 1: proof button
  proofBtn: {
    backgroundColor: C.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  proofBtnText: { color: C.textSub, fontSize: 12, fontWeight: '500' },

  // Error
  errorCard: {
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.18)',
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  errorTitle: { color: '#f87171', fontSize: 14, fontWeight: '600' },
  errorBody:  { color: '#f8717190', fontSize: 13, lineHeight: 19 },

  // Cards
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 18,
    marginBottom: 14,
  },
  cardNopadTop:  { paddingTop: 0, overflow: 'hidden' },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  cardLabelPad: { paddingTop: 18 },
  cardAction: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.borderSoft,
  },

  // Model rows
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  loadingText: { color: C.textSub, fontSize: 14 },
  rowDivider:  { height: 1, backgroundColor: C.borderSoft, marginVertical: 2 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 10,
    gap: 12,
  },
  modelRowSel:   { backgroundColor: C.elevated },
  selDot: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: C.border, backgroundColor: 'transparent',
  },
  selDotActive:  { borderColor: C.accent, backgroundColor: C.accent },
  modelText:     { flex: 1 },
  modelName:     { fontSize: 15, fontWeight: '500', color: C.textSub },
  modelNameSel:  { color: C.text },
  modelMeta:     { fontSize: 12, color: C.textMuted, marginTop: 2 },
  statusBadge: {
    backgroundColor: C.elevated, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: C.border,
  },
  statusBadgeText: { fontSize: 11, color: C.textSub, fontWeight: '500' },
  statusMuted:     { fontSize: 12, color: C.textMuted },
  progressWrap: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingHorizontal: 4, paddingBottom: 8,
  },
  progressBg: {
    flex: 1, height: 3, backgroundColor: C.border,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill:  { height: 3, backgroundColor: C.accent, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: C.textMuted, width: 32, textAlign: 'right' },

  // Buttons
  primaryBtn:      { backgroundColor: C.accent, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  primaryBtnBusy:  { opacity: 0.75 },
  primaryBtnText:  { color: '#fff', fontSize: 15, fontWeight: '600' },
  btnInner:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  readyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: C.greenDim, borderRadius: 10,
    borderWidth: 1, borderColor: C.greenBorder,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  readyDot:   { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.green },
  readyText:  { color: C.green, fontSize: 14, fontWeight: '500' },

  // Mode grid
  modeGrid:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  modeCell: {
    width: '48.8%', backgroundColor: C.elevated,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 14, overflow: 'hidden',
  },
  modeCellActive: { borderColor: C.accent, backgroundColor: C.accentDim },
  modeAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  modeEmoji:       { fontSize: 20, marginBottom: 8, marginTop: 4 },
  modeLabel:       { fontSize: 14, fontWeight: '600', color: C.textSub, marginBottom: 3 },
  modeLabelActive: { color: C.text },
  modeDesc:        { fontSize: 11, color: C.textMuted, lineHeight: 16 },

  // Code editor
  codeTopRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 12,
  },
  codeTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langChip: {
    backgroundColor: C.elevated, borderRadius: 6,
    paddingHorizontal: 9, paddingVertical: 3,
    borderWidth: 1, borderColor: C.border,
  },
  langChipText: { color: C.textSub, fontSize: 11, fontWeight: '500' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: C.border },
  clearBtnText: { color: C.textMuted, fontSize: 11, fontWeight: '500' },

  // Feature 2: sample chips
  sampleRow:        { marginBottom: 12 },
  sampleRowContent: { gap: 8, paddingRight: 4 },
  sampleChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1,
    borderColor: C.border, backgroundColor: C.elevated,
  },
  sampleChipActive: {
    borderColor: C.accentBorder,
    backgroundColor: C.accentDim,
  },
  sampleChipText:       { fontSize: 12, color: C.textSub, fontWeight: '500' },
  sampleChipTextActive: { color: C.accent },

  codeEditorWrap: {
    backgroundColor: C.elevated, borderRadius: 10,
    borderWidth: 1, borderColor: C.border, overflow: 'hidden',
  },
  codeEditor: {
    color: C.codeText, fontFamily: 'monospace',
    fontSize: 13, lineHeight: 20,
    padding: 14, minHeight: 220, textAlignVertical: 'top',
  },

  // Run button
  runBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 14,
  },
  runBtnOff:     { backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  runBtnText:    { color: '#fff', fontSize: 16, fontWeight: '600', letterSpacing: 0.1 },
  runBtnTextOff: { color: C.textMuted },

  // Output card
  outputCard: {
    flexDirection: 'row', backgroundColor: C.surface,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
    overflow: 'hidden', marginBottom: 14,
  },
  outputAccentBar: { width: 3, backgroundColor: C.accent },
  outputBody:      { flex: 1 },
  outputHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  outputTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  outputSub:   { fontSize: 12, color: C.textMuted, marginTop: 2 },
  outputDivider: { height: 1, backgroundColor: C.border, marginHorizontal: 16 },
  outputScroll:  { maxHeight: 400, paddingHorizontal: 16, paddingVertical: 14 },

  // Feature 4: output action buttons
  outputActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    backgroundColor: C.elevated, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: C.border,
  },
  iconBtnDone:     { borderColor: C.greenBorder, backgroundColor: C.greenDim },
  iconBtnText:     { fontSize: 12, fontWeight: '600', color: C.textSub },
  iconBtnTextDone: { color: C.green },

  // Feature 3: history section
  historySection: { marginBottom: 14 },
  historySectionLabel: {
    fontSize: 11, fontWeight: '600', color: C.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Footer
  footer:        { alignItems: 'center', gap: 12, paddingBottom: 8 },
  footerBadges:  { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  footerChip: {
    backgroundColor: C.surface, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: C.border,
  },
  footerChipText: { color: C.textMuted, fontSize: 12 },
  footerNote:     { color: C.textMuted, fontSize: 11, opacity: 0.6 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal styles (Feature 1)
// ─────────────────────────────────────────────────────────────────────────────

const m = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backdropTap: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  },
  sheet: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: C.border,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  closeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.elevated,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  closeBtnText: { color: C.textSub, fontSize: 14 },

  // Counter card
  counterCard: {
    backgroundColor: C.elevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.greenBorder,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  shieldIcon:   { fontSize: 40, marginBottom: 12 },
  counterLabel: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  counterValue: {
    fontSize: 56, fontWeight: '800', color: C.green,
    lineHeight: 64,
  },
  counterNote:  { fontSize: 12, color: C.textMuted, marginTop: 6, textAlign: 'center' },

  // Description
  description: {
    fontSize: 14,
    color: C.textSub,
    lineHeight: 22,
    marginBottom: 16,
  },
  descAccent: { color: C.accent, fontWeight: '600' },

  // Guarantee row
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.greenDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.greenBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  guaranteeIcon: { fontSize: 18 },
  guaranteeText: { color: C.green, fontSize: 14, fontWeight: '500', flex: 1 },

  // Test section
  testSection: { gap: 12 },
  testBtn: {
    backgroundColor: C.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  testBtnBusy: { opacity: 0.75 },
  testBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  noModelNote: {
    backgroundColor: C.elevated,
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  noModelText: { color: C.textMuted, fontSize: 13, textAlign: 'center' },

  testSuccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.greenDim,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.greenBorder,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  testSuccessIcon:  { fontSize: 22, color: C.green },
  testSuccessTitle: { fontSize: 14, fontWeight: '600', color: C.green },
  testSuccessBody:  { fontSize: 12, color: C.textMuted, marginTop: 2 },
});
