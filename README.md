# XTS Tournament — React + Firebase + Vercel

এটা একটা পূর্ণাঙ্গ Tournament Website: Login (Google + Email/Password), Home (Match categories), My Matches, Leaderboard, এবং Profile (Wallet request system) — সব real Firebase backend দিয়ে কানেক্টেড।

---

## ১. Firebase Project বানানো

1. https://console.firebase.google.com এ যান → **Add project** → নাম দিন (যেমন `xts-tournament`)
2. প্রজেক্ট খুললে বাম দিকে **Build → Authentication → Get started**
   - **Sign-in method** ট্যাবে গিয়ে **Google** চালু করুন (Enable → Save)
   - **Email/Password** ও চালু করুন (Enable → Save)
3. **Build → Firestore Database → Create database** → Production mode → কাছের region বেছে Create করুন
4. **Project settings (⚙️ আইকন) → General** এ scroll করে **Your apps → Web (</>) আইকন** এ ক্লিক করে একটা Web App যোগ করুন
5. যে `firebaseConfig` object দেখাবে, তার মান গুলো কপি করে রাখুন — পরের ধাপে লাগবে

---

## ২. Local এ প্রজেক্ট চালানো

```bash
npm install
cp .env.example .env.local
```

`.env.local` ফাইল খুলে Firebase Console থেকে পাওয়া মানগুলো বসান:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

তারপর:
```bash
npm run dev
```
Browser এ `http://localhost:5173` খুলে দেখুন।

---

## ৩. Firestore Rules বসানো

Firebase Console → **Firestore Database → Rules** ট্যাবে যান, এই প্রজেক্টের `firestore.rules` ফাইলের পুরো কনটেন্ট কপি-পেস্ট করে **Publish** করুন।

---

## ৪. Sample Tournament ডেটা যোগ করা (Test করার জন্য)

Firebase Console → **Firestore Database → Start collection** → নাম দিন `tournaments`, তারপর একটা document বানান:

| Field | Type | Value |
|---|---|---|
| title | string | Free Fire BR Squad #1 |
| category | string | br |
| entryFee | number | 20 |
| prizePool | number | 500 |
| slots | number | 48 |
| filled | number | 0 |
| status | string | open |

`category` এর মান অবশ্যই এর একটা হতে হবে: `br`, `clash_squad`, `lone_wolf`, `lost_to_win`, `cs_arena`, `free_match` — কোড এই key গুলো দিয়ে filter করে।

Login করে Home page এ গেলে এই ম্যাচটা BR Match card এ দেখা যাবে।

---

## ৫. Google Login কাজ করার জন্য (Deploy করার পর)

Vercel এ deploy করার পর যে domain পাবেন (যেমন `xts-tournament.vercel.app`), সেটা Firebase Console → **Authentication → Settings → Authorized domains** এ যোগ করে দিতে হবে। নাহলে লাইভ সাইটে Google login কাজ করবে না।

---

## ৬. GitHub এ Push করা

```bash
git init
git add .
git commit -m "XTS Tournament initial version"
```
GitHub এ নতুন repo বানিয়ে:
```bash
git remote add origin আপনার-repo-link
git branch -M main
git push -u origin main
```

---

## ৭. Vercel এ Deploy করা

1. https://vercel.com → **Add New → Project** → GitHub repo সিলেক্ট করুন
2. **Environment Variables** এ `.env.local` এর ৬টা key-value যোগ করুন
3. **Deploy** চাপুন
4. Deploy শেষে পাওয়া URL টা Firebase Authorized domains এ যোগ করুন (ধাপ ৫ দেখুন)

কাস্টম Domain যুক্ত করার জন্য আগের guide-এর "ধাপ ৮ ও ৯" অনুসরণ করুন (Domain কেনা ও Vercel Settings → Domains এ যুক্ত করা)।

---

## ৮. Wallet System সম্পর্কে গুরুত্বপূর্ণ নোট

এই ভার্সনে **Add Money / Withdraw** সরাসরি টাকা transfer করে না — এটা `walletRequests` collection এ একটা pending request জমা করে। Balance বাড়ানো/কমানো (real টাকা পাঠানো/নেওয়ার পর) **Firebase Console থেকে manually** করতে হবে:

1. Firestore → `walletRequests` কালেকশনে গিয়ে request টা দেখুন
2. bKash/Rocket/Nagad এ টাকা এসেছে/গেছে কিনা verify করুন
3. `users/{userId}` document এ গিয়ে `walletBalance` field manually update করুন
4. `walletRequests` document এর `status` কে `approved` করে দিন

এভাবে করার কারণ: সরাসরি payment gateway API (bKash Merchant, SSLCommerz ইত্যাদি) ছাড়া কোনো app থেকে automatically real টাকা move করা ঠিক না, এবং বাংলাদেশে real-money contest/wallet platform চালানোর regulatory দিক থাকতে পারে — এই ব্যাপারে একজন আইনজীবীর পরামর্শ নেওয়া ভালো। ভবিষ্যতে licensed payment gateway যুক্ত করে এই manual approval automate করা যাবে।

---

## Folder Structure

```
src/
  firebase.js           → Firebase config + init
  context/AuthContext.jsx → Login/Register/Logout logic, user profile
  pages/Auth.jsx         → Login/Register screen
  pages/Home.jsx         → Match categories + Join flow
  pages/Matches.jsx      → My joined matches
  pages/Leaderboard.jsx  → Wins/Earnings ranking
  pages/Profile.jsx      → Wallet + Add Money/Withdraw requests
  components/            → TopBar, BottomNav, ProtectedRoute
```
