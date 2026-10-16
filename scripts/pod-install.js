/**
 * Installs iOS CocoaPods dependencies after `npm install` (macOS only).
 *
 * Bare React Native needs `pod install` before the iOS app can build, but
 * `react-native run-ios` doesn't run it for you. Hooking it into postinstall
 * means a fresh clone is build-ready right after `npm install`.
 */
const { execSync } = require('child_process');

if (process.platform !== 'darwin') {
  process.exit(0);
}

try {
  execSync('pod install', { cwd: 'ios', stdio: 'inherit' });
} catch (err) {
  console.warn(
    '\npod install failed. Run "cd ios && pod install" manually before building for iOS.\n' +
      'If CocoaPods is missing, install it with "brew install cocoapods".'
  );
}
