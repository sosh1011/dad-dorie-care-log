# Dad & Dorie Care Log

A small installable web app (PWA) for logging dementia-care hours for Dad & Dorie, plus contacts, logins, and appointments. Works on laptop and phone, offline, with no account or server.

## How it works
- **The app is the main place to log.** Everything is saved in this browser on this device (IndexedDB).
- **The Google Sheet stays as a backup / export target.** On the Hours tab tap **Copy hours for Sheet**, then paste into the Sheet's *Log* tab at the first empty row (columns Date, Who, Activity, Hours, Notes). Or download the CSV and ask the Hours bot to import it.
- **Laptop ↔ phone:** More → **Export backup**, then open the file on the other device (or email it to yourself) and use **Import backup**. Import merges; the newest edit of each entry wins.

## Add to Home Screen
- **iPhone (Safari):** open the link → Share button → *Add to Home Screen*. Notifications need iOS 16.4+ and the Home Screen app.
- **Android (Chrome):** menu ⋮ → *Install app* / *Add to Home screen*.
- **Laptop (Chrome/Edge):** install icon in the address bar.

## Logins & passphrase
The first time you open **Logins**, you set a passphrase. Passwords are encrypted on the device (AES-GCM, key from the passphrase via PBKDF2) and never leave it. **If you forget the passphrase, saved passwords can't be recovered.** The section locks itself after 10 minutes.

**Emailing passwords is discouraged.** Print and email leave passwords out unless you tick "Include passwords". Backups leave them out unless you tick "Include encrypted passwords" (they stay encrypted with your passphrase).

## Reminders
Reminders pop up while the app is open or was recently open on that device, and the next 48 hours of appointments show in a banner at the top. For anything critical, also tap 📅 to add it to your phone calendar.

## Files
`index.html`, `app.js`, `styles.css`, `manifest.json`, `sw.js`, `icons/`. No build step. Serve the folder as a static site.

## Editing dropdown lists
Tap **✎ Edit list** next to *Task type* (or **✎ Edit suggestions** next to a contact's *Role*, or More → Dropdown lists) to add, rename, reorder, or delete options. Renaming a task type also updates past entries. Lists are saved on the device and included in backups.
