// scripts/get-firestore-rules2.cjs
const { initializeApp, cert, getApps, getApp } = require("firebase-admin/app");

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

const https = require("https");

async function getRuleset() {
  const app = getApp();
  const token = await app.options.credential.getAccessToken();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const rulesetId = "eb134243-a1ec-479e-8cfc-01c07f2d44f8";

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'firebaserules.googleapis.com',
      path: `/v1/projects/${projectId}/rulesets/${rulesetId}`,
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

getRuleset().then(data => {
  const files = data.source?.files ?? [];
  files.forEach(f => {
    console.log("=== FILE:", f.name, "===");
    console.log(f.content);
  });
  process.exit(0);
}).catch(err => {
  console.error("Erro:", err.message);
  process.exit(1);
});
