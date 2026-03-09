require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUser(email) {
  console.log('Checking for user with email:', email);
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase()));
  const snap = await getDocs(q);
  
  console.log('\nResults:', snap.size, 'document(s) found\n');
  
  if (snap.empty) {
    console.log('❌ No user document found in Firestore for:', email);
    console.log('\nThe user may need to:');
    console.log('1. Sign up again (recommended), OR');
    console.log('2. Have their user document created manually');
  } else {
    snap.forEach(doc => {
      console.log('✅ Found user document:');
      console.log('User ID:', doc.id);
      console.log('Data:', JSON.stringify(doc.data(), null, 2));
    });
  }
  process.exit(0);
}

const email = process.argv[2] || 'akshay@gmail.com';
checkUser(email).catch(console.error);
