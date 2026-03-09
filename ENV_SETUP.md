# Environment Variables Setup

This app uses environment variables to securely manage sensitive configuration data like API keys and project IDs.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the `.env.example` file to create your local `.env` file:

```bash
cp .env.example .env
```

Then edit `.env` and fill in your actual values:

- **Firebase Configuration**: Get these from [Firebase Console](https://console.firebase.google.com/)
- **EAS Project ID**: Get this from [Expo Dashboard](https://expo.dev/)
- **App Configuration**: Update with your app details

### 3. Important Notes

- **Never commit `.env` to version control** - it's already in `.gitignore`
- Always use `.env.example` as a template for new team members
- For production deployments, set environment variables in your CI/CD or hosting platform

## Environment Variables Reference

### Firebase Configuration
- `FIREBASE_API_KEY`: Your Firebase API key
- `FIREBASE_AUTH_DOMAIN`: Firebase authentication domain
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_STORAGE_BUCKET`: Firebase storage bucket
- `FIREBASE_MESSAGING_SENDER_ID`: Firebase messaging sender ID
- `FIREBASE_APP_ID`: Firebase app ID
- `FIREBASE_MEASUREMENT_ID`: Firebase measurement ID (for Analytics)

### EAS Configuration
- `EAS_PROJECT_ID`: Your Expo Application Services project ID

### App Configuration
- `APP_NAME`: Display name of your app
- `APP_SLUG`: URL-friendly app identifier
- `APP_VERSION`: Current app version
- `APP_OWNER`: Expo account owner username
- `IOS_BUNDLE_ID`: iOS bundle identifier
- `ANDROID_PACKAGE`: Android package name

## Deployment

### EAS Build

When building with EAS, you can set environment variables:

1. Using `eas.json`:
```json
{
  "build": {
    "production": {
      "env": {
        "FIREBASE_API_KEY": "your-key-here"
      }
    }
  }
}
```

2. Or using EAS Secrets (recommended):
```bash
eas secret:create --scope project --name FIREBASE_API_KEY --value your-key-here
```

### App Store / Play Store Submission

Before submitting to stores:

1. Ensure all environment variables are set correctly
2. Update `APP_VERSION` in `.env`
3. Build using: `eas build --platform ios` or `eas build --platform android`

## Development

The app uses:
- `react-native-dotenv` for environment variables in React Native code
- `dotenv` for Node.js scripts and app configuration

After changing `.env`, you may need to:
1. Clear Metro bundler cache: `expo start -c`
2. Rebuild the app for native changes
