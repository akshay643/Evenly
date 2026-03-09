# evynly - Split Expenses App

A React Native expense splitting app built with Expo and Firebase.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator (Mac) or Android Emulator

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd evynly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and add your Firebase and Expo configuration.
   See [ENV_SETUP.md](./ENV_SETUP.md) for detailed instructions.

4. **Start the development server**
   ```bash
   npm start
   ```

5. **Run on your device**
   - Scan the QR code with Expo Go app (iOS/Android)
   - Or press `i` for iOS Simulator
   - Or press `a` for Android Emulator

## 📁 Project Structure

```
evynly/
├── src/
│   ├── components/     # Reusable UI components
│   ├── screens/        # App screens
│   ├── navigation/     # Navigation configuration
│   ├── services/       # API and Firebase services
│   ├── context/        # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── utils/          # Utility functions
│   └── config/         # App configuration
├── assets/             # Images, fonts, icons
├── android/            # Android native code
├── ios/                # iOS native code
├── .env                # Environment variables (not in git)
├── .env.example        # Environment template
└── app.config.js       # Expo configuration
```

## 🔐 Environment Variables

This app uses environment variables for sensitive configuration.

- **Development**: Copy `.env.example` to `.env` and fill in your values
- **Production**: Use EAS Secrets (see [DEPLOYMENT.md](./DEPLOYMENT.md))

Required environment variables:
- Firebase configuration (API keys, project ID, etc.)
- EAS project ID
- App metadata

See [ENV_SETUP.md](./ENV_SETUP.md) for complete setup guide.

## 🛠️ Development

### Available Scripts

```bash
npm start          # Start Expo development server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run in web browser
```

### Utility Scripts

```bash
# Check if a user exists in Firestore
node check-user.js email@example.com

# Create a missing user document
node create-missing-user.js email@example.com password "Display Name"
```

## 📱 Features

- ✅ Expense splitting with multiple methods (equal, exact, percentage, shares)
- ✅ Group management
- ✅ Balance calculations
- ✅ Settlement tracking
- ✅ Push notifications
- ✅ Premium features
- ✅ Recurring expenses
- ✅ Analytics and insights
- ✅ Export data
- ✅ Receipt scanning

## 🏗️ Building & Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Build Commands

```bash
# Build for development
eas build --profile development

# Build for production
eas build --profile production --platform all

# Submit to App Store
eas submit --platform ios --profile production

# Submit to Play Store
eas submit --platform android --profile production
```

## 🔒 Security

- All sensitive keys are stored in environment variables
- `.env` file is excluded from version control
- Use EAS Secrets for production deployments
- Firebase security rules protect user data
- Authentication required for all actions

## 📚 Documentation

- [Environment Setup](./ENV_SETUP.md) - Detailed environment configuration
- [Deployment Guide](./DEPLOYMENT.md) - App Store and Play Store submission

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## 📄 License

Private project - All rights reserved

## 🐛 Troubleshooting

### App won't start
1. Clear cache: `expo start -c`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check `.env` file is configured correctly

### Build fails
1. Verify all environment variables are set
2. Check EAS secrets: `eas secret:list`
3. Clear build cache: `eas build --clear-cache`

### Firebase errors
1. Verify Firebase configuration in `.env`
2. Check Firebase console for project status
3. Ensure `google-services.json` and `GoogleService-Info.plist` are up to date

## 📞 Support

For issues and questions, please create an issue in the repository.
