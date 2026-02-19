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
  Image,
} from "react-native";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { auth, db } from "../../firebase.config";

import { doc, setDoc, getDoc } from "firebase/firestore";

// Required for Google auth redirect to complete in Expo
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_WEB_CLIENT_ID =
  "240071770069-fsr0agatmehmuao4gjm9tgtintv0bj80.apps.googleusercontent.com";
const GOOGLE_IOS_CLIENT_ID =
  "240071770069-1u99bkld8873k8m0u5qam0hq41l9bro3.apps.googleusercontent.com";
const GOOGLE_ANDROID_CLIENT_ID =
  "240071770069-6slejsht0h266q1prjui92l1sd49cf1l.apps.googleusercontent.com";

// Reversed iOS client ID scheme — Google accepts this for iOS clients
// ASWebAuthenticationSession intercepts this redirect without needing it in Info.plist
const IOS_REVERSED_CLIENT_ID =
  "com.googleusercontent.apps.240071770069-1u99bkld8873k8m0u5qam0hq41l9bro3";
const REDIRECT_URI = `${IOS_REVERSED_CLIENT_ID}:/oauthredirect`;

// Google OAuth endpoints
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

  // Auth code flow with PKCE using iOS client ID (no client_secret needed)
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_IOS_CLIENT_ID,
      redirectUri: REDIRECT_URI,
      scopes: ["openid", "profile", "email"],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery,
  );

  // Handle Google auth response
  useEffect(() => {
    if (response?.type === "success") {
      const { code } = response.params;
      exchangeCodeAndSignIn(code);
    } else if (response?.type === "error") {
      Alert.alert(
        "Google Sign-In Error",
        response.error?.message || "Something went wrong",
      );
      setGoogleLoading(false);
    } else if (response?.type === "dismiss") {
      setGoogleLoading(false);
    }
  }, [response]);

  const exchangeCodeAndSignIn = async (code) => {
    try {
      // Exchange auth code for tokens (iOS client + PKCE = no client_secret needed)
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

      // Sign in to Firebase with the id_token
      const credential = GoogleAuthProvider.credential(
        tokenData.id_token,
        tokenData.access_token,
      );
      const userCredential = await signInWithCredential(auth, credential);
      const {
        uid,
        email: userEmail,
        displayName,
        photoURL,
      } = userCredential.user;

      // Create/update user doc in Firestore
      const userRef = doc(db, "users", uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          email: userEmail?.toLowerCase() || "",
          name: displayName || userEmail?.split("@")[0] || "User",
          photoURL: photoURL || null,
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
    setGoogleLoading(true);
    await promptAsync();
  };

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (!isLogin && !name) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const userDocRef = doc(db, "users", userCredential.user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            email: email.toLowerCase(),
            name: email.split("@")[0],
            createdAt: Date.now(),
          });
        }
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: email.toLowerCase(),
          name: name.trim(),
          createdAt: Date.now(),
        });
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.innerContainer}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>Evenly</Text>
        <Text style={styles.subtitle}>Split bills fairly</Text>

        {/* ── Google Sign-In ── */}
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

        {/* ── Divider ── */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {!isLogin && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>
              {isLogin ? "Sign In" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account? Sign Up"
              : "Already have an account? Sign In"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  innerContainer: { flex: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 72, textAlign: "center", marginBottom: 8 },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#6B7280",
    marginBottom: 36,
  },

  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleIcon: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4285F4",
    marginRight: 10,
  },
  googleBtnTxt: { fontSize: 16, fontWeight: "600", color: "#1F2937" },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerTxt: { marginHorizontal: 12, color: "#9CA3AF", fontSize: 14 },

  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  button: {
    backgroundColor: "#6366F1",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  switchText: {
    textAlign: "center",
    color: "#6366F1",
    marginTop: 20,
    fontSize: 14,
  },
});
