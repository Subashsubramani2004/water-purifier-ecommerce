# 💧 Water Purifier E-Commerce

A full-stack water purifier e-commerce application built with **React Native, Expo, React, Vite, and Firebase**. The platform provides customers with a convenient shopping experience, supports dealer applications and role-based access, and enables administrators to manage products, orders, and dealer requests.

## 🚀 Project Overview

Water Purifier E-Commerce is designed to simplify the process of purchasing water purifiers, replacement filters, pumps, dispensers, and related accessories.

The project consists of two applications connected to a shared Firebase backend:

- **Mobile Application:** Customer shopping and dealer functionality using Expo and React Native.
- **Admin Dashboard:** Web-based administration panel built with React and Vite.

The customer and dealer experiences are handled through role-based authentication rather than separate application deployments.

## ✨ Features

### 📱 Mobile Application

- User registration and login with Firebase Authentication.
- Persistent authentication sessions.
- Role-based access for customers and dealers.
- Product catalog with product images and stock information.
- Product search and category filtering.
- Product details and pricing.
- Shopping cart with quantity controls.
- Dealer application submission.
- Firebase Firestore integration for application data.
- Android APK builds using Expo Application Services (EAS).

### 🛠️ Admin Dashboard

- Admin dashboard for managing the e-commerce platform.
- Product management with pricing, stock, image URLs, and active status.
- Order management.
- Dealer application management.
- Firebase Authentication and Firestore integration.
- Responsive web interface with Lucide icons.

### 🔐 Authentication and Security

- Firebase Authentication for user sign-in.
- Role-based authorization for customer, dealer, and admin access.
- Dealer applications can be reviewed by administrators.
- Firestore security rules to control access to application data.
- Firebase configuration managed through environment variables.

> **Security note:** Privileged operations must be protected by backend authorization and Firestore security rules. Never include payment provider secret keys or other server-side secrets in the mobile application.

## 🧰 Tech Stack

| Technology | Purpose |
|---|---|
| React Native | Mobile application UI |
| Expo | Mobile development and builds |
| React | Admin dashboard UI |
| Vite | Web development and build tooling |
| Firebase Authentication | User authentication |
| Cloud Firestore | Database |
| Firebase Security Rules | Database access control |
| Lucide React | Admin dashboard icons |
| Expo Application Services (EAS) | Android application builds |
| Vercel | Admin dashboard deployment |

## 📂 Project Structure

```text
wpe/
├── mobile/                 # Expo React Native application
│   ├── assets/
│   ├── src/
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   └── .env                # Local configuration; do not commit
│
├── admin-web/              # React + Vite admin dashboard
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── .env                # If required locally
│
├── firebase/               # Firebase configuration and rules
├── functions/              # Backend functions, if configured
├── firebase.json
├── firestore.rules
├── .gitignore
└── README.md
```

*The exact files and subdirectories may vary as the project evolves.*

## ⚙️ Prerequisites

Install the following before running the project:

- [Node.js](https://nodejs.org/)
- npm
- [Git](https://git-scm.com/)
- A Firebase project
- Expo Go for development testing on a physical device

An Expo account is required for EAS cloud builds.

## 🔧 Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd wpe
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual repository URL.

### 2. Configure Firebase

Open the [Firebase Console](https://console.firebase.google.com/) and select your Firebase project.

Enable Firebase Authentication and configure the sign-in methods required by the application. Create a Cloud Firestore database and deploy the appropriate security rules.

For the mobile application, create `mobile/.env` and add your Firebase configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

Replace the placeholders with the values from your Firebase project settings.

**Important:** Never commit `.env` files containing project configuration or credentials to a public repository. Client-side Firebase API keys are not equivalent to server secrets, but database security rules and API restrictions are still essential.

### 3. Run the Mobile Application

Open a terminal in the mobile directory:

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go on your Android device, or use the available Expo development options.

### 4. Run the Admin Dashboard

Open a separate terminal:

```bash
cd admin-web
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

```text
http://localhost:5173
```

Configure any Firebase environment variables required by the admin application using the names expected by its Firebase initialization code.

## 📦 Building the Android APK

The mobile application uses Expo Application Services for cloud builds.

From the mobile directory, authenticate with Expo:

```bash
npx eas-cli@latest login
```

Configure EAS if needed:

```bash
npx eas-cli@latest build:configure
```

Ensure `eas.json` contains an appropriate preview build profile configured to generate an APK.

Start the Android preview build:

```bash
npx eas-cli@latest build --platform android --profile preview
```

After the build completes, download the APK from the Expo build page and install it on a compatible Android device.

Make sure the required `EXPO_PUBLIC_FIREBASE_*` environment variables are available to the EAS build environment.

## 🌐 Deployment

### Admin Dashboard

The React/Vite admin dashboard can be deployed to Vercel.

1. Push the project to GitHub.
2. Import the repository into [Vercel](https://vercel.com/).
3. Set the project root directory to `admin-web`.
4. Configure the required environment variables.
5. Use the appropriate Vite build command and output directory.
6. Deploy the project.

Typical Vite settings:

```text
Build command: npm run build
Output directory: dist
```

If the dashboard uses client-side routing, configure the appropriate rewrite rules so refreshing a nested route serves the application correctly.

### Mobile Application

The Android application can be distributed using the APK generated by EAS. A separate mobile deployment to Vercel is not required.

## 🔄 Application Workflow

1. A customer registers or logs in.
2. Firebase Authentication manages the user's authenticated session.
3. The application checks the user's role and account status.
4. Customers browse products and manage their shopping cart.
5. Dealers can submit applications for administrative review.
6. Administrators manage products, orders, and dealer applications through the web dashboard.
7. Firestore security rules enforce permitted database operations.

## 🔮 Future Enhancements

- Secure payment integration using Razorpay test mode.
- Server-side payment order creation and signature verification.
- Order history and delivery status tracking.
- Installation, maintenance, and repair bookings.
- Push notifications for important order updates.
- Dealer-specific wholesale pricing and ordering workflows.
- Improved reporting and analytics for administrators.

## 👨‍💻 Development Notes

- Keep mobile and admin dependencies installed in their respective directories.
- Use the same Firebase project for applications that share data.
- Configure and test Firestore security rules before production use.
- Do not grant administrator privileges through public registration.
- Keep payment secrets on a trusted server, never in the client application.
- Test authentication and database access on the installed APK, not only in Expo Go.

## 📄 License

This project was developed as a software development assignment. Add an appropriate license before distributing or reusing the source code publicly.

---

**Water Purifier E-Commerce**  
*Making water purification products easier to discover and purchase.*
