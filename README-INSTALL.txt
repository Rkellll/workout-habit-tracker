FITTRACK COMBINED UPDATE

Files included:
- src/App.jsx: account-isolation update (UID-specific local storage and per-user Firestore loading).
- src/AuthGate.jsx: login/register screen with Privacy Policy modal and UID-keyed App mount.
- src/PrivacyPolicy.css: styles for the Privacy Policy link and modal.

INSTALLATION
1. Back up your project folder first.
2. Extract this ZIP.
3. Copy the included src files into your project's src folder, replacing matching files and adding PrivacyPolicy.css.
4. From the project folder, run: npm.cmd run build
5. If the build succeeds, deploy using your usual method.

NOTE
The privacy notice is a starting point and should be reviewed by the app owner. Confirm Firebase Firestore security rules prevent users from reading/writing other users' private data. Shared old localStorage data is not automatically migrated to every account; manually recover it only into the correct account if needed.
