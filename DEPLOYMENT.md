# evynly - Deployment Guide

## Pre-Deployment Checklist

### 1. Environment Variables Setup

Ensure all sensitive keys are configured using EAS Secrets (recommended for production):

```bash
# Firebase Configuration
eas secret:create --scope project --name FIREBASE_API_KEY --value "your-api-key"
eas secret:create --scope project --name FIREBASE_AUTH_DOMAIN --value "your-auth-domain"
eas secret:create --scope project --name FIREBASE_PROJECT_ID --value "your-project-id"
eas secret:create --scope project --name Firebase_STORAGE_BUCKET --value "your-storage-bucket"
eas secret:create --scope project --name FIREBASE_MESSAGING_SENDER_ID --value "your-sender-id"
eas secret:create --scope project --name FIREBASE_APP_ID --value "your-app-id"
eas secret:create --scope project --name FIREBASE_MEASUREMENT_ID --value "your-measurement-id"

# EAS Configuration
eas secret:create --scope project --name EAS_PROJECT_ID --value "your-eas-project-id"

# App Configuration
eas secret:create --scope project --name APP_VERSION --value "1.0.0"
```

### 2. Verify Credentials

Ensure your Firebase and Apple/Google developer credentials are properly configured:

```bash
# Check current credentials
eas credentials

# Configure iOS credentials (if needed)
eas credentials -p ios

# Configure Android credentials (if needed)
eas credentials -p android
```

### 3. Update Version Numbers

Before each app store submission, update your version:

```env
APP_VERSION=1.0.1  # in .env or via secrets
```

For Android, the `versionCode` auto-increments via EAS.

## Building for Production

### iOS Build (App Store)

```bash
# Build for iOS production
eas build --platform ios --profile production

# Or build for both platforms
eas build --platform all --profile production
```

### Android Build (Play Store)

```bash
# Build for Android production
eas build --platform android --profile production
```

### Preview/Internal Testing

```bash
# Build preview version for internal testing
eas build --platform all --profile preview
```

## Submission to App Stores

### iOS App Store

```bash
# Submit to App Store
eas submit --platform ios --profile production

# Follow prompts to:
# - Select the build to submit
# - Provide App Store Connect credentials
```

Before submission, ensure:
- App Store Connect app record is created
- All required metadata is filled
- Privacy policy URL is set
- Screenshots are uploaded

### Google Play Store

```bash
# Submit to Play Store
eas submit --platform android --profile production

# Follow prompts to:
# - Select the build to submit
# - Upload Android Service Account key (first time only)
```

Before submission, ensure:
- Play Console app is created
- All required store listing details are complete
- Content rating questionnaire is filled
- Privacy policy is set

## Environment-Specific Builds

### Development
```bash
eas build --platform all --profile development
```
Uses: Development channel, dev client

### Preview
```bash
eas build --platform all --profile preview
```
Uses: Preview channel, internal distribution

### Production
```bash
eas build --platform all --profile production
```
Uses: Production channel, store distribution

## Managing Secrets

### View all secrets
```bash
eas secret:list
```

### Delete a secret
```bash
eas secret:delete --name SECRET_NAME
```

### Update a secret
Delete and recreate:
```bash
eas secret:delete --name FIREBASE_API_KEY
eas secret:create --scope project --name FIREBASE_API_KEY --value "new-value"
```

## Important Security Notes

1. **Never commit `.env` file** - it's in `.gitignore`
2. **Use EAS Secrets** for production builds
3. **Rotate API keys** regularly
4. **Use separate Firebase projects** for dev/staging/production
5. **Keep `google-services.json` and `GoogleService-Info.plist` secure**

## Post-Deployment

### Monitor Firebase
- Check Firebase Console for any errors
- Monitor authentication metrics
- Review Firestore usage

### Monitor App Performance
- Check crash analytics
- Review user feedback
- Monitor API usage

### OTA Updates
For minor updates that don't require store resubmission:

```bash
# Publish an update
eas update --channel production --message "Bug fixes"
```

## Troubleshooting

### Build fails
1. Check EAS secrets are set correctly
2. Verify credentials are valid
3. Check build logs: `eas build:list`

### App crashes on launch
1. Verify all environment variables are set
2. Check Firebase configuration
3. Review native logs in Xcode/Android Studio

### Environment variables not working
1. Clear babel cache: `expo start -c`
2. Rebuild: `eas build --clear-cache`
3. Verify secrets with `eas secret:list`

## Support

For more information:
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Submit Documentation](https://docs.expo.dev/submit/introduction/)
- [Environment Variables Guide](https://docs.expo.dev/build-reference/variables/)
