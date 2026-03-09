require('dotenv').config();

export default {
  expo: {
    name: process.env.APP_NAME || "evynly - Split Expenses",
    slug: process.env.APP_SLUG || "evynly",
    scheme: "evynly",
    version: process.env.APP_VERSION || "1.0.0",
    owner: process.env.APP_OWNER || "akshay643",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0F0F23",
    },
    newArchEnabled: true,

    ios: {
      supportsTablet: true,
      bundleIdentifier: process.env.IOS_BUNDLE_ID || "com.evynly.app",
      googleServicesFile: "./GoogleService-Info.plist",
      infoPlist: {
        NSCameraUsageDescription: "Used to scan receipts",
        NSPhotoLibraryUsageDescription: "Used to attach receipt photos"
      }
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#6366F1"
      },
      edgeToEdgeEnabled: true,
      package: process.env.ANDROID_PACKAGE || "com.evynly.app",
      googleServicesFile: "./google-services.json",
      versionCode: 1,
      permissions: [
        "INTERNET",
        "NOTIFICATIONS",
        "CAMERA"
      ]
    },

    web: {
      favicon: "./assets/favicon.png"
    },

    plugins: [
      "expo-web-browser",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#6366F1",
          defaultChannel: "default"
        }
      ],
      [
        "expo-splash-screen",
        {
          backgroundColor: "#0F0F23",
          image: "./assets/splash-icon.png",
          imageWidth: 200
        }
      ],
      ["@react-native-google-signin/google-signin"]
    ],

    extra: {
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "7bf3bd2b-f6d4-4f6b-af45-d9552efc6a35"
      }
    },

    runtimeVersion: "1.0.0",

    updates: {
      url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID || "7bf3bd2b-f6d4-4f6b-af45-d9552efc6a35"}`
    }
  }
};
