import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { accountError, createAccount, emailIsVerified, resetPassword, sendVerificationEmail, signedInEmail, signInAccount, signOutAccount } from '../account';
import { theme } from '../theme';

const RESET_NOTE =
  'If that email has an account, a reset link is on the way. Check the inbox and the spam folder, set a new password, then sign in here.';

type Mode = 'in' | 'up' | 'reset';

export function SignInScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const go = (next: Mode) => {
    setMode(next);
    setError('');
    setNotice('');
  };

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

  const heading = mode === 'up' ? 'Create your account' : mode === 'reset' ? 'Reset password' : 'Sign in';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28 }]}>
      <Text style={styles.brand}>My Rental Fleet</Text>
      <Text style={styles.heading}>{heading}</Text>
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
      {mode === 'reset' ? null : (
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.muted}
          secureTextEntry
        />
      )}
      {mode === 'in' ? (
        <Pressable onPress={() => go('reset')} disabled={busy} hitSlop={8}>
          <Text style={styles.forgot}>Forgot password</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable style={styles.button} disabled={busy} onPress={() => void (mode === 'reset' ? forgot() : submit())}>
        {busy ? (
          <ActivityIndicator color={theme.ink} />
        ) : (
          <Text style={styles.buttonText}>{mode === 'up' ? 'Create account' : mode === 'reset' ? 'Send reset email' : 'Sign in'}</Text>
        )}
      </Pressable>
      {mode === 'reset' ? (
        <Pressable onPress={() => go('in')} hitSlop={8}>
          <Text style={styles.switch}>Back to sign in</Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => go(mode === 'up' ? 'in' : 'up')} hitSlop={8}>
          <Text style={styles.switch}>{mode === 'up' ? 'I already have an account' : 'Create an account'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function VerifyEmailScreen({ onVerified }: { onVerified: () => void }) {
  const insets = useSafeAreaInsets();
  const email = signedInEmail();
  const [busy, setBusy] = useState<'check' | 'send' | ''>('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const key = `fleet-verify-sent:${email}`;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key) === '1') return;
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');
    void sendVerificationEmail()
      .then(() => setNotice(`A confirmation link was sent to ${email || 'your email'}. Check the inbox and the spam folder.`))
      .catch((err) => {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
        setError(accountError(err));
      });
  }, [email]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onBack = () => {
      if (document.visibilityState !== 'visible') return;
      void emailIsVerified().then((ok) => {
        if (ok) onVerified();
      });
    };
    document.addEventListener('visibilitychange', onBack);
    return () => document.removeEventListener('visibilitychange', onBack);
  }, [onVerified]);

  const resend = async () => {
    setBusy('send');
    setError('');
    setNotice('');
    try {
      await sendVerificationEmail();
      setNotice(`A confirmation link was sent to ${email || 'your email'}. Check the inbox and the spam folder.`);
    } catch (err) {
      setError(accountError(err));
    } finally {
      setBusy('');
    }
  };

  const check = async () => {
    setBusy('check');
    setError('');
    try {
      const ok = await emailIsVerified();
      if (ok) onVerified();
      else setError('That email is not confirmed yet. Open the link in the message, then tap this again.');
    } catch (err) {
      setError(accountError(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 28 }]}>
      <Text style={styles.brand}>My Rental Fleet</Text>
      <Text style={styles.heading}>Confirm your email</Text>
      <Text style={styles.body}>
        A link was sent to {email || 'your email'}. Tap it once so the account is tied to the right address. Signing in after that will not ask again.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable style={styles.button} disabled={busy !== ''} onPress={() => void check()}>
        {busy === 'check' ? <ActivityIndicator color={theme.ink} /> : <Text style={styles.buttonText}>I tapped the link</Text>}
      </Pressable>
      <Pressable style={styles.ghost} disabled={busy !== ''} onPress={() => void resend()}>
        {busy === 'send' ? <ActivityIndicator color={theme.text} /> : <Text style={styles.ghostText}>Send the email again</Text>}
      </Pressable>
      <Pressable onPress={() => void signOutAccount()} hitSlop={8}>
        <Text style={styles.switch}>Use a different email</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 20 },
  brand: { color: theme.text, fontSize: 17, fontWeight: '700' },
  heading: { color: theme.text, fontSize: 32, fontWeight: '800', marginTop: 18, marginBottom: 18 },
  body: { color: theme.text, fontSize: 16, lineHeight: 22, marginBottom: 16 },
  input: { backgroundColor: theme.card, borderRadius: 14, borderWidth: 1, borderColor: theme.line, paddingHorizontal: 14, paddingVertical: 14, fontSize: 16, color: theme.text, marginBottom: 10 },
  forgot: { color: theme.accent, fontWeight: '800', fontSize: 16, marginBottom: 8 },
  button: { backgroundColor: theme.action, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  buttonText: { color: theme.ink, fontWeight: '800', fontSize: 17 },
  ghost: { borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 10, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.card },
  ghostText: { color: theme.text, fontWeight: '800', fontSize: 17 },
  switch: { color: theme.accent, fontWeight: '800', fontSize: 16, marginTop: 18 },
  error: { color: theme.danger, marginBottom: 8, lineHeight: 20 },
  notice: { color: theme.text, marginBottom: 8, lineHeight: 22 },
});
