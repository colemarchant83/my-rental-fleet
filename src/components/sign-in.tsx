import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accountError, createAccount, resetPassword, signInAccount } from '../account';
import { theme } from '../theme';

const RESET_NOTE =
  'If that email has an account, a reset link is on the way. Check the inbox and the spam folder, set a new password, then sign in here.';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Enter an email and a password.');
      setNotice('');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (mode === 'up') await createAccount(email, password);
      else await signInAccount(email, password);
    } catch (err) {
      setError(accountError(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError('Enter the email on the account.');
      setNotice('');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resetPassword(email);
      setNotice(RESET_NOTE);
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : '';
      if (code === 'auth/user-not-found') setNotice(RESET_NOTE);
      else setError(accountError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28 }]}>
      <Text style={styles.brand}>My Rental Fleet</Text>
      <Text style={styles.heading}>{mode === 'up' ? 'Create your account' : 'Sign in'}</Text>
      <Text style={styles.help}>
        Machines, rental cards, and maintenance records stay with this account. They are still there on a new phone when you sign in.
      </Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={theme.muted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={theme.muted}
        secureTextEntry
      />
      {mode === 'in' ? (
        <Pressable onPress={() => void forgot()} disabled={busy} hitSlop={8}>
          <Text style={styles.forgot}>Forgot password</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable style={styles.button} disabled={busy} onPress={() => void submit()}>
        {busy ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.buttonText}>{mode === 'up' ? 'Create account' : 'Sign in'}</Text>}
      </Pressable>
      <Pressable
        onPress={() => {
          setMode(mode === 'up' ? 'in' : 'up');
          setError('');
          setNotice('');
        }}
        hitSlop={8}
      >
        <Text style={styles.switch}>{mode === 'up' ? 'I already have an account' : 'Create an account'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 20 },
  brand: { color: theme.text, fontSize: 17, fontWeight: '700' },
  heading: { color: theme.text, fontSize: 32, fontWeight: '800', marginTop: 18 },
  help: { color: theme.muted, fontSize: 16, lineHeight: 22, marginTop: 10, marginBottom: 18 },
  input: { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: theme.text, marginBottom: 10 },
  forgot: { color: theme.accent, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  button: { backgroundColor: theme.action, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { color: theme.ink, fontWeight: '800', fontSize: 17 },
  switch: { color: theme.accent, fontWeight: '800', fontSize: 16, marginTop: 18 },
  error: { color: theme.danger, marginBottom: 8, lineHeight: 20 },
  notice: { color: theme.text, marginBottom: 8, lineHeight: 22 },
});
