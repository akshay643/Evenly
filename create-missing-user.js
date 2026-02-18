const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyCyVDBJVFCu9otK51Z1p9BHLEfbkdY_TPU",
  authDomain: "evenly-6ff36.firebaseapp.com",
  projectId: "evenly-6ff36",
  storageBucket: "evenly-6ff36.firebasestorage.app",
  messagingSenderId: "422293063354",
  appId: "1:422293063354:web:01e0c41e2d72d5c89e0ab3"
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
