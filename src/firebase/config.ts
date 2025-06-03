// Firebase კონფიგურაცია
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { getDatabase } from 'firebase/database';
import { getFunctions } from 'firebase/functions';

// Firebase კონფიგურაცია
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
  databaseURL: 'https://projec-cca43-default-rtdb.europe-west1.firebasedatabase.app'
};

// Firebase ინიციალიზაცია
let app;
let db;
let auth;
let storage;
let rtdb;
let functions;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);
  rtdb = getDatabase(app);
  functions = getFunctions(app);

  // ლოგირება დებაგისთვის
  if (typeof window !== 'undefined') {
    console.log("Firebase initialized with project:", firebaseConfig.projectId);
    console.log("Authentication service initialized");
    console.log("Firestore database initialized");
    console.log("Realtime database initialized");
  }
} catch (error) {
  console.error("Error initializing Firebase:", error);
  // Initialize with empty objects to prevent app from crashing
  app = {};
  db = {};
  auth = {};
  storage = {};
  rtdb = {};
  functions = {};
}

export { app, auth, db, storage, rtdb, functions }; 