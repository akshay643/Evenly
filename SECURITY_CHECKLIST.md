# Security Checklist for App Store Deployment

## ✅ Pre-Deployment Security Review

### Environment Variables
- [ ] All sensitive keys moved to `.env` file
- [ ] `.env` file is in `.gitignore`
- [ ] `.env.example` created with placeholder values
- [ ] Production keys configured in EAS Secrets
- [ ] No hardcoded API keys in source code
- [ ] Environment variables properly loaded in all files

### Firebase Security
- [ ] Firebase Security Rules are properly configured
- [ ] Authentication required for all sensitive operations
- [ ] Firestore rules prevent unauthorized access
- [ ] Storage rules protect user uploads
- [ ] API keys restricted to app domains (optional but recommended)
- [ ] Using separate Firebase projects for dev/prod (recommended)

### Code Security
- [ ] No console.log statements with sensitive data
- [ ] No commented-out credentials
- [ ] No test/debug code in production builds
- [ ] Error messages don't expose sensitive information
- [ ] All user inputs are validated

### Build Configuration
- [ ] `google-services.json` (Android) contains correct project credentials
- [ ] `GoogleService-Info.plist` (iOS) contains correct project credentials
- [ ] App bundle identifiers are correctly configured
- [ ] Version numbers are updated
- [ ] app.config.js uses environment variables
- [ ] No sensitive data in `app.json` or `app.config.js`

### Repository Security
- [ ] `.env` file is NOT committed to git
- [ ] `.env.example` has no real values
- [ ] No secrets in commit history
- [ ] `google-services.json` and `GoogleService-Info.plist` handling decided:
  - Option 1: Add to `.gitignore` and manage separately
  - Option 2: Keep in repo (they're project-specific, not secret)
  
### App Store Requirements
- [ ] Privacy policy URL is set and accessible
- [ ] Terms of service created (if applicable)
- [ ] App description doesn't make false claims
- [ ] Age rating is appropriate
- [ ] Data collection is properly disclosed

### iOS Specific
- [ ] Bundle identifier matches Apple Developer account
- [ ] Signing certificate is valid
- [ ] Provisioning profile is correct
- [ ] Push notification certificate configured
- [ ] App icon meets requirements

### Android Specific
- [ ] Package name is unique and correct
- [ ] Keystore file is secure (not in git)
- [ ] Signing configuration is correct
- [ ] Google Play Services configured
- [ ] Required permissions are justified

### Testing
- [ ] Tested build on physical iOS device
- [ ] Tested build on physical Android device
- [ ] All features work without development API keys
- [ ] Push notifications work in production
- [ ] Authentication flows work correctly
- [ ] Payment features work (if applicable)
- [ ] Offline functionality tested

### Backup & Recovery
- [ ] Keystore backed up securely (Android)
- [ ] Apple Developer credentials documented
- [ ] Firebase project ownership verified
- [ ] EAS account access documented
- [ ] All credentials stored in secure location (1Password, etc.)

## 🔐 Security Best Practices

### During Development
1. **Never commit `.env`** to version control
2. **Use different API keys** for development and production
3. **Rotate keys regularly** (every 6-12 months)
4. **Limit API key permissions** where possible
5. **Monitor Firebase usage** for unusual activity

### For Production
1. **Use EAS Secrets** for all sensitive environment variables
2. **Enable Firebase App Check** for additional security
3. **Implement rate limiting** on backend operations
4. **Monitor error logs** for security issues
5. **Keep dependencies updated** for security patches

### Post-Launch
1. **Monitor Firebase Console** for unusual patterns
2. **Review app analytics** for suspicious behavior
3. **Implement crash reporting** (Firebase Crashlytics)
4. **Have incident response plan** ready
5. **Regular security audits** of Firebase rules

## 🚨 What to Do If Keys Are Exposed

If API keys or secrets are accidentally exposed:

1. **Immediately rotate all exposed keys**
   - Firebase: Generate new keys in Firebase Console
   - EAS: Update secrets with `eas secret:create`

2. **Check for unauthorized usage**
   - Review Firebase usage metrics
   - Check for unexpected costs
   - Look for unauthorized data access

3. **Update all deployments**
   - Update `.env` locally
   - Update EAS Secrets
   - Rebuild and redeploy app if needed

4. **Review security**
   - Audit commit history
   - Check all contributors' access
   - Review Firebase security rules

5. **Document the incident**
   - What was exposed
   - When it was exposed
   - Actions taken
   - Lessons learned

## 📋 Final Pre-Submission Checklist

Before running `eas submit`:

1. [ ] All secrets are in EAS Secrets (not `.env`)
2. [ ] Build tested on real devices
3. [ ] All features work as expected
4. [ ] No development/debug code remains
5. [ ] Version numbers are correct
6. [ ] Privacy policy is live and linked
7. [ ] App store assets ready (screenshots, description)
8. [ ] Distribution certificates valid
9. [ ] Firebase production project configured
10. [ ] All team members have necessary access

## 🎯 Recommended Tools

- **1Password / Bitwarden**: Store credentials securely
- **Firebase App Check**: Additional API security
- **Sentry / Crashlytics**: Error monitoring
- **GitHub Dependabot**: Dependency security alerts
- **npm audit**: Check for vulnerable packages

## 📞 Emergency Contacts

Document these before deployment:

- Firebase project owner: _______________
- Apple Developer Account admin: _______________
- Google Play Console admin: _______________
- EAS account owner: _______________
- Domain registrar access: _______________

---

**Last Updated**: Before each App Store/Play Store submission
**Next Review**: After every major release
