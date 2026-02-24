// src/screens/AuthScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
} from "firebase/auth";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../../firebase.config";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { validateEmail } from "../utils/emailValidation";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID =
  "240071770069-1u99bkld8873k8m0u5qam0hq41l9bro3.apps.googleusercontent.com";
const IOS_REVERSED_CLIENT_ID =
  "com.googleusercontent.apps.240071770069-1u99bkld8873k8m0u5qam0hq41l9bro3";
const REDIRECT_URI = `${IOS_REVERSED_CLIENT_ID}:/oauthredirect`;

const isIOS = Platform.OS === "ios";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verificationPassword, setVerificationPassword] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);

  // Google auth (iOS only)
  const authRequest = isIOS
    ? AuthSession.useAuthRequest(
        {
          clientId: GOOGLE_IOS_CLIENT_ID,
          redirectUri: REDIRECT_URI,
          scopes: ["openid", "profile", "email"],
          responseType: AuthSession.ResponseType.Code,
          usePKCE: true,
        },
        discovery
      )
    : [null, null, null];

  const [request, response, promptAsync] = authRequest;

  useEffect(() => {
    if (!isIOS || !response) return;

    if (response.type === "success") {
      exchangeCodeAndSignIn(response.params.code);
    } else if (response.type === "error") {
      Alert.alert("Google Sign-In Error", response.error?.message || "Something went wrong");
      setGoogleLoading(false);
    } else if (response.type === "dismiss") {
      setGoogleLoading(false);
    }
  }, [response]);

  const exchangeCodeAndSignIn = async (code) => {
    try {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: [
          `client_id=${encodeURIComponent(GOOGLE_IOS_CLIENT_ID)}`,
          `code=${encodeURIComponent(code)}`,
          `code_verifier=${encodeURIComponent(request.codeVerifier)}`,
          `grant_type=authorization_code`,
          `redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
        ].join("&"),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error);
      }

      const credential = GoogleAuthProvider.credential(tokenData.id_token, tokenData.access_token);
      const userCredential = await signInWithCredential(auth, credential);
      const { uid, email: userEmail, displayName, photoURL } = userCredential.user;

      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: userEmail?.toLowerCase() || "",
          name: displayName || userEmail?.split("@")[0] || "User",
          photoURL: photoURL || null,
          emailVerified: true,
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isIOS) {
      Alert.alert("Not Available", "Google Sign-In is only available on iOS. Please use email and password.");
      return;
    }
    setGoogleLoading(true);
    await promptAsync();
  };

  // ═══════════════════════════════════════════════
  // EMAIL/PASSWORD AUTH WITH VALIDATION
  // ═══════════════════════════════════════════════
  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!isLogin && !name) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    // ═══ EMAIL VALIDATION (blocks disposable emails) ═══
    // Set second parameter to true for whitelist-only mode
    const emailValidation = validateEmail(email.trim(), false);
    if (!emailValidation.valid) {
      Alert.alert("Invalid Email", emailValidation.error);
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);

        if (!userCredential.user.emailVerified) {
          await signOut(auth);
          setVerificationEmail(email.trim().toLowerCase());
          setVerificationPassword(password);
          setShowVerification(true);
          setLoading(false);
          return;
        }

        const userDocRef = doc(db, "users", userCredential.user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: email.trim().toLowerCase(),
            name: email.split("@")[0],
            emailVerified: true,
            createdAt: Date.now(),
          });
        } else {
          await setDoc(userDocRef, { emailVerified: true }, { merge: true });
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        await sendEmailVerification(userCredential.user);

        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: email.trim().toLowerCase(),
          name: name.trim(),
          emailVerified: false,
          createdAt: Date.now(),
        });

        await signOut(auth);
        setVerificationEmail(email.trim().toLowerCase());
        setVerificationPassword(password);
        setShowVerification(true);

        Alert.alert("Verification Email Sent! 📧", `We've sent a verification link to ${email.trim()}. Please check your inbox.`);
      }
    } catch (error) {
      console.error("Auth error:", error.code);
      
      switch (error.code) {
        case "auth/email-already-in-use":
          Alert.alert("Email Already Registered", "This email is already in use. Try signing in instead.");
          break;
        case "auth/invalid-email":
          Alert.alert("Invalid Email", "Please enter a valid email address.");
          break;
        case "auth/weak-password":
          Alert.alert("Weak Password", "Password should be at least 6 characters.");
          break;
        case "auth/user-not-found":
          Alert.alert("Account Not Found", "No account found with this email. Please sign up.");
          break;
        case "auth/wrong-password":
        case "auth/invalid-credential":
          Alert.alert("Invalid Credentials", "Email or password is incorrect.");
          break;
        case "auth/too-many-requests":
          Alert.alert("Too Many Attempts", "Please wait a few minutes before trying again.");
          break;
        default:
          Alert.alert("Error", error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail || !verificationPassword) {
      Alert.alert("Error", "Please enter your password to resend verification.");
      return;
    }

    setResendLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, verificationEmail, verificationPassword);
      await sendEmailVerification(userCredential.user);
      await signOut(auth);
      Alert.alert("Email Sent! 📧", `Verification email sent to ${verificationEmail}.`);
    } catch (error) {
      if (error.code === "auth/too-many-requests") {
        Alert.alert("Too Many Requests", "Please wait a few minutes before trying again.");
      } else {
        Alert.alert("Error", "Failed to resend. Please try again.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!verificationEmail || !verificationPassword) {
      Alert.alert("Error", "Please enter your password to continue.");
      return;
    }

    setCheckingVerification(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, verificationEmail, verificationPassword);
      await userCredential.user.reload();

      if (userCredential.user.emailVerified) {
        await setDoc(doc(db, "users", userCredential.user.uid), { emailVerified: true }, { merge: true });
        setShowVerification(false);
        setVerificationEmail("");
        setVerificationPassword("");
        Alert.alert("Success! 🎉", "Your email is verified. Welcome to Evenly!");
      } else {
        await signOut(auth);
        Alert.alert("Not Verified Yet", "Please click the link in the email we sent you.");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to check verification. Please try again.");
    } finally {
      setCheckingVerification(false);
    }
  };

  // ═══ VERIFICATION SCREEN ═══
  if (showVerification) {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
        <ScrollView contentContainerStyle={styles.verificationContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.verificationIconContainer}>
            <Ionicons name="mail-unread-outline" size={64} color="#6366F1" />
          </View>

          <Text style={styles.verificationTitle}>Verify Your Email</Text>
          <Text style={styles.verificationText}>We've sent a verification link to:</Text>
          <Text style={styles.verificationEmail}>{verificationEmail}</Text>

          <View style={styles.verificationSteps}>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Open your email inbox</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Click the verification link</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Come back and tap the button below</Text>
            </View>
          </View>

          <Text style={styles.verificationHint}>💡 Check your spam/junk folder if you don't see it</Text>

          <View style={styles.passwordSection}>
            <Text style={styles.passwordLabel}>Enter your password:</Text>
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={verificationPassword}
              onChangeText={setVerificationPassword}
              secureTextEntry
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, !verificationPassword && styles.buttonDisabled]}
            onPress={handleCheckVerification}
            disabled={checkingVerification || !verificationPassword}
          >
            {checkingVerification ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>I've Verified My Email</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={handleResendVerification}
            disabled={resendLoading || !verificationPassword}
          >
            {resendLoading ? (
              <ActivityIndicator color="#6366F1" size="small" />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={18} color="#6366F1" style={{ marginRight: 6 }} />
                <Text style={styles.resendBtnText}>Resend Verification Email</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setShowVerification(false);
              setVerificationEmail("");
              setVerificationPassword("");
              setEmail("");
              setPassword("");
            }}
          >
            <Ionicons name="arrow-back" size={18} color="#6B7280" />
            <Text style={styles.backBtnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ═══ MAIN AUTH SCREEN ═══
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.innerContainer}>
          <Text style={styles.logo}>💰</Text>
          <Text style={styles.title}>Evenly</Text>
          <Text style={styles.subtitle}>Split bills fairly</Text>

          {isIOS ? (
            <>
              <TouchableOpacity
                style={styles.googleBtn}
                onPress={handleGoogleSignIn}
                disabled={googleLoading || !request}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#1F2937" size="small" />
                ) : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleBtnTxt}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerTxt}>or</Text>
                <View style={styles.dividerLine} />
              </View>
            </>
          ) : (
            <View style={styles.androidBanner}>
              <Ionicons name="mail-outline" size={20} color="#6366F1" />
              <Text style={styles.androidBannerText}>Sign in with your email below</Text>
            </View>
          )}

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              placeholderTextColor="#9CA3AF"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor="#9CA3AF"
          />

          <TextInput
            style={styles.input}
            placeholder="Password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#9CA3AF"
          />

          <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>{isLogin ? "Sign In" : "Create Account"}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setIsLogin(!isLogin);
              setEmail("");
              setPassword("");
              setName("");
            }}
          >
            <Text style={styles.switchText}>
              {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </Text>
          </TouchableOpacity>

          {!isLogin && (
            <Text style={styles.infoText}>
              📧 We'll send you a verification email. Temporary/disposable emails are not allowed.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  scrollContent: { flexGrow: 1 },
  innerContainer: { flex: 1, justifyContent: "center", padding: 24, paddingTop: 60, paddingBottom: 40 },
  logo: { fontSize: 72, textAlign: "center", marginBottom: 8 },
  title: { fontSize: 36, fontWeight: "bold", textAlign: "center", color: "#1F2937" },
  subtitle: { fontSize: 16, textAlign: "center", color: "#6B7280", marginBottom: 36 },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  googleIcon: { fontSize: 18, fontWeight: "bold", color: "#4285F4", marginRight: 10 },
  googleBtnTxt: { fontSize: 16, fontWeight: "600", color: "#1F2937" },
  androidBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2FF", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20, marginBottom: 20, borderWidth: 1, borderColor: "#C7D2FE" },
  androidBannerText: { fontSize: 14, color: "#6366F1", fontWeight: "500", marginLeft: 8 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerTxt: { marginHorizontal: 12, color: "#9CA3AF", fontSize: 14 },
  input: { backgroundColor: "#fff", padding: 15, borderRadius: 10, marginBottom: 14, fontSize: 16, borderWidth: 1, borderColor: "#E5E7EB", color: "#1F2937" },
  button: { backgroundColor: "#6366F1", padding: 15, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", marginTop: 4, marginBottom: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  switchText: { textAlign: "center", color: "#6366F1", marginTop: 20, fontSize: 14, fontWeight: "500" },
  infoText: { textAlign: "center", color: "#9CA3AF", marginTop: 16, fontSize: 13, lineHeight: 18 },
  
  // Verification styles
  verificationContainer: { flexGrow: 1, justifyContent: "center", padding: 24, alignItems: "center" },
  verificationIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: "#EEF2FF", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  verificationTitle: { fontSize: 28, fontWeight: "bold", color: "#1F2937", marginBottom: 16, textAlign: "center" },
  verificationText: { fontSize: 16, color: "#6B7280", textAlign: "center", marginBottom: 8 },
  verificationEmail: { fontSize: 17, fontWeight: "700", color: "#6366F1", textAlign: "center", marginBottom: 24 },
  verificationSteps: { backgroundColor: "#fff", borderRadius: 12, padding: 16, width: "100%", marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  stepRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#6366F1", justifyContent: "center", alignItems: "center", marginRight: 12 },
  stepNumberText: { color: "#fff", fontWeight: "bold", fontSize: 14 },
  stepText: { fontSize: 15, color: "#4B5563", flex: 1 },
  verificationHint: { fontSize: 14, color: "#6B7280", textAlign: "center", marginBottom: 24, backgroundColor: "#FEF3C7", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, overflow: "hidden" },
  passwordSection: { width: "100%", marginBottom: 16 },
  passwordLabel: { fontSize: 14, fontWeight: "600", color: "#4B5563", marginBottom: 8 },
  resendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, paddingHorizontal: 24, marginTop: 8 },
  resendBtnText: { color: "#6366F1", fontSize: 15, fontWeight: "600" },
  backBtn: { flexDirection: "row", alignItems: "center", paddingVertical: 14, marginTop: 8 },
  backBtnText: { color: "#6B7280", fontSize: 14, marginLeft: 6 },
});