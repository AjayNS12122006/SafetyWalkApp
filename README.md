# SafetyWalk 🛡️

## Run the full app (backend + mobile)

**1. Start the backend**
```bash
cd backend
npm install
npm start
```
This runs on `http://localhost:4000` and stores data in `backend/data/db.json`.

**2. Point the app at your backend**
Edit `lib/config.js` and set `API_HOST` to your computer's LAN IP (find it
with `ipconfig getifaddr en0` on Mac, `ipconfig` on Windows, or `hostname -I`
on Linux). `localhost` won't work from a phone — see the comment in that
file for details.

**3. Install and start the app**
```bash
npm install
npx expo start
```
Scan the QR code with Expo Go, or run on a simulator/emulator.

See `backend/README.md` for the full API reference and how the
server-enforced auto-SOS timer works.

---

# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
