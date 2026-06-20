const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();
const GROUP_ID = process.env.VITE_COUPLE_ID ?? 'arthur-namorada-2026';

async function fixZaraRole() {
  const snap = await db.collection('groups').doc(GROUP_ID).collection('members').get();
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.name && data.name.toLowerCase().includes('zara')) {
      console.log('Fixing role for Zara (' + doc.id + ') from ' + data.role + ' to member...');
      await db.collection('groups').doc(GROUP_ID).collection('members').doc(doc.id).update({
        role: 'member'
      });
      console.log('Done!');
    }
  }
}

fixZaraRole().catch(console.error);
