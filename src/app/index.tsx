import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { apiRequest, SECURITY_QUESTIONS } from '../services/api';

type AuthMode = 'login' | 'register' | 'forgot';

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      Alert.alert('Validasi', 'Masukkan format email yang valid.');
      return false;
    }
    if (mode !== 'forgot' && password.length < 6) {
      Alert.alert('Validasi', 'Sandi minimal 6 karakter.');
      return false;
    }
    if (mode !== 'login' && !securityQuestion) {
      Alert.alert('Validasi', 'Pilih pertanyaan keamanan.');
      return false;
    }
    if (mode !== 'login' && !securityAnswer.trim()) {
      Alert.alert('Validasi', 'Masukkan jawaban keamanan.');
      return false;
    }
    if (mode === 'forgot' && newPassword.length < 6) {
      Alert.alert('Validasi', 'Sandi baru minimal 6 karakter.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const cleanEmail = email.trim();
    setLoading(true);

    if (mode === 'forgot') {
      const result = await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          securityQuestion,
          securityAnswer,
          newPassword,
        }),
      });
      setLoading(false);

      if (!result.ok) {
        Alert.alert('Gagal', result.message);
        return;
      }

      Alert.alert('Sandi Berhasil Diubah', result.message, [
        {
          text: 'OK',
          onPress: () => {
            setNewPassword('');
            setSecurityAnswer('');
            setMode('login');
          },
        },
      ]);
      return;
    }

    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const result = await apiRequest<{ token?: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        email: cleanEmail,
        password,
        securityQuestion,
        securityAnswer,
      }),
    });
    setLoading(false);

    if (!result.ok) {
      Alert.alert('Gagal', result.message);
      return;
    }

    router.replace('/products' as never);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Kasir UMKM</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' && 'Masuk menggunakan Email & Sandi'}
            {mode === 'register' && 'Daftar Akun Pemilik UMKM'}
            {mode === 'forgot' && 'Pemulihan Sandi Lokal'}
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="pemilik@toko.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {mode !== 'forgot' && (
            <>
              <Text style={styles.label}>Sandi (min. 6 karakter)</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimal 6 karakter"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </>
          )}

          {mode !== 'login' && (
            <>
              <Text style={styles.label}>Pertanyaan Keamanan</Text>
              <View style={styles.questionOptions}>
                {SECURITY_QUESTIONS.map((question) => (
                  <TouchableOpacity
                    key={question}
                    style={[
                      styles.questionOption,
                      securityQuestion === question &&
                        styles.questionOptionSelected,
                    ]}
                    onPress={() => setSecurityQuestion(question)}
                  >
                    <Text
                      style={[
                        styles.questionOptionText,
                        securityQuestion === question &&
                          styles.questionOptionTextSelected,
                      ]}
                    >
                      {question}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Jawaban Keamanan</Text>
              <TextInput
                style={styles.input}
                placeholder="Masukkan jawaban Anda"
                value={securityAnswer}
                onChangeText={setSecurityAnswer}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          {mode === 'forgot' && (
            <>
              <Text style={styles.label}>Sandi Baru (min. 6 karakter)</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimal 6 karakter"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoComplete="new-password"
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? 'Memproses...'
                : mode === 'login'
                ? 'Masuk'
                : mode === 'register'
                ? 'Daftar'
                : 'Ubah Sandi'}
            </Text>
          </TouchableOpacity>

          {mode === 'login' && (
            <>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setMode('forgot')}
              >
                <Text style={styles.linkText}>Lupa sandi?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={() => setMode('register')}
              >
                <Text style={styles.linkText}>Belum punya akun? Daftar</Text>
              </TouchableOpacity>
            </>
          )}

          {mode !== 'login' && (
            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setMode('login')}
            >
              <Text style={styles.linkText}>Kembali ke Login</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    elevation: 3,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 16,
    backgroundColor: '#F8FAFC',
  },
  questionOptions: {
    marginBottom: 16,
  },
  questionOption: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: '#F8FAFC',
  },
  questionOptionSelected: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },
  questionOptionText: {
    fontSize: 14,
    color: '#475569',
  },
  questionOptionTextSelected: {
    color: '#C2410C',
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#F97316',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  linkBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#475569',
    fontSize: 13,
  },
});