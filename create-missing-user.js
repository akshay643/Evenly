require('dotenv').config();
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

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
const auth = getAuth(app);

async function createMissingUserDoc(email, password, name) {
  try {
    console.log('Signing in as:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    
    console.log('User UID:', uid);
    console.log('Creating Firestore user document...');
    
    await setDoc(doc(db, 'users', uid), {
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      createdAt: new Date().toISOString(),
    });
    
    console.log('✅ User document created successfully!');
    console.log('You can now add this user to groups.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4];

if (!email || !password) {
  console.log('Usage: node create-missing-user.js <email> <password> [name]');
  console.log('Example: node create-missing-user.js akshay@gmail.com mypassword "Akshay"');
  process.exit(1);
}

createMissingUserDoc(email, password, name);
