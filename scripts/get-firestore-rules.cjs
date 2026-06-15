// scripts/get-firestore-rules.cjs
// Lê as regras atuais do Firestore via Firebase Admin SDK
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

// Usa a API REST do Firebase Security Rules para ler as regras atuais
const https = require("https");
const { getAuth } = require("firebase-admin/auth");

async function getCurrentRules() {
  // Precisamos de um access token do service account
  const app = require("firebase-admin/app").getApp();
  const credential = app.options.credential;
  const token = await credential.getAccessToken();

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const url = `https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firebaserules.googleapis.com',
      path: `/v1/projects/${projectId}/releases`,
      headers: { Authorization: `Bearer ${token.access_token}` }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

getCurrentRules().then(data => {
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}).catch(err => {
  console.error("Erro:", err.message);
  process.exit(1);
});
