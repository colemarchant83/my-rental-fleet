import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDuS7DPR4HFJ9HwzdzTdRZI9-eiJq82z0g",
  authDomain: "my-rental-fleet.firebaseapp.com",
  projectId: "my-rental-fleet",
  storageBucket: "my-rental-fleet.firebasestorage.app",
  messagingSenderId: "15785291713",
  appId: "1:15785291713:web:b0927a089be7fd9c120940"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);