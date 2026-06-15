// scripts/migrate-to-groups.cjs
// Versão CommonJS (Node puro) do script de migração — sem dependência de ts-node.
// Roda com: node --env-file=.env.local scripts/migrate-to-groups.cjs

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

// ── Firebase Admin init ──────────────────────────────────────────────────────
if (!getApps().length) {
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    console.error("❌ Variáveis FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY são obrigatórias.");
    process.exit(1);
  }

  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db   = getFirestore();
const auth = getAuth();

const COUPLE_ID  = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
const GROUP_ID   = COUPLE_ID;
const GROUP_NAME = "Grupo Arthur e Zara";

function inferNameFromEmail(email) {
  const prefix = email.split("@")[0].toLowerCase();
  if (prefix.includes("arthur")) return "Arthur";
  if (prefix.includes("zara"))   return "Zara";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

async function readMembersFromCouple() {
  console.log(`\n📋 [Passo 1] Lendo membros de couples/${COUPLE_ID}...`);
  const coupleSnap = await db.collection("couples").doc(COUPLE_ID).get();

  if (!coupleSnap.exists) {
    console.error(`❌ Documento couples/${COUPLE_ID} não encontrado.`);
    process.exit(1);
  }

  const data    = coupleSnap.data();
  const members = data.members;

  if (!members || typeof members !== "object") {
    console.error("❌ Campo 'members' não encontrado. Campos:", Object.keys(data).join(", "));
    process.exit(1);
  }

  const uids = Object.entries(members).filter(([, v]) => v === true).map(([uid]) => uid);

  if (uids.length === 0) {
    console.error("❌ Nenhum UID com valor true encontrado em members.");
    console.error("   Conteúdo de members:", JSON.stringify(members, null, 2));
    process.exit(1);
  }

  console.log(`   ✅ UIDs encontrados: ${uids.join(", ")}`);
  return uids;
}

async function resolveUserEmails(uids) {
  console.log(`\n📋 [Passo 2] Resolvendo emails via Firebase Auth...`);
  const result = [];

  for (const uid of uids) {
    try {
      const userRecord = await auth.getUser(uid);
      const email = userRecord.email ?? `${uid}@casalpay.local`;
      const name  = userRecord.displayName ?? inferNameFromEmail(email);
      console.log(`   ✅ UID ${uid} → ${name} <${email}>`);
      result.push({ uid, email, name });
    } catch (err) {
      console.warn(`   ⚠️  Não encontrou UID ${uid} no Auth:`, err.message);
      result.push({ uid, email: `${uid}@casalpay.local`, name: `Usuário ${uid.slice(0, 6)}` });
    }
  }

  return result;
}

async function ensureGroupDocument(createdByUid) {
  console.log(`\n📋 [Passo 3] Criando/verificando groups/${GROUP_ID}...`);
  const groupRef = db.collection("groups").doc(GROUP_ID);
  const snap     = await groupRef.get();

  if (snap.exists) {
    console.log(`   ✅ Grupo já existe (idempotente): "${snap.data().name}"`);
    await groupRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  } else {
    await groupRef.set({
      name:           GROUP_NAME,
      createdBy:      createdByUid,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
      legacyCoupleId: COUPLE_ID,
    });
    console.log(`   ✅ Grupo criado: "${GROUP_NAME}"`);
  }
}

async function ensureGroupMembers(users) {
  console.log(`\n📋 [Passo 4] Criando/verificando membros em groups/${GROUP_ID}/members/...`);
  for (const { uid, email, name } of users) {
    await db.collection("groups").doc(GROUP_ID).collection("members").doc(uid).set(
      { userId: uid, name, email, role: "admin", status: "active", joinedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log(`   ✅ Membro upsert: ${name} (${uid})`);
  }
}

async function ensureUserProfiles(users) {
  console.log(`\n📋 [Passo 5] Criando/verificando perfis em users/{uid}...`);
  for (const { uid, email, name } of users) {
    await db.collection("users").doc(uid).set(
      { userId: uid, name, email, activeGroupId: GROUP_ID, defaultGroupId: GROUP_ID, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    console.log(`   ✅ Perfil upsert: ${name} → activeGroupId="${GROUP_ID}"`);
  }
}

async function backfillGroupIdOnTransactions() {
  console.log(`\n📋 [Passo 6] Adicionando groupId nas transações sem esse campo...`);
  const snap = await db.collection("couples").doc(COUPLE_ID).collection("transactions").get();

  if (snap.empty) { console.log("   ℹ️  Nenhuma transação encontrada."); return; }

  let updated = 0, skipped = 0, batchCount = 0;
  let batch = db.batch();

  for (const docSnap of snap.docs) {
    if (docSnap.data().groupId) { skipped++; continue; }
    batch.update(docSnap.ref, { groupId: GROUP_ID, updatedAt: FieldValue.serverTimestamp() });
    updated++;
    batchCount++;
    if (batchCount >= 450) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
      console.log(`   ... commit parcial (${updated} até agora)`);
    }
  }
  if (batchCount > 0) await batch.commit();

  console.log(`   ✅ ${updated} transação(ões) atualizadas, ${skipped} já tinham groupId.`);
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CasalPay — Script de Migração: Etapa 1 (Grupo Inicial)  ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  COUPLE_ID : ${COUPLE_ID}`);
  console.log(`  GROUP_NAME: ${GROUP_NAME}`);
  console.log("═══════════════════════════════════════════════════════════");

  const uids  = await readMembersFromCouple();
  const users = await resolveUserEmails(uids);
  await ensureGroupDocument(uids[0]);
  await ensureGroupMembers(users);
  await ensureUserProfiles(users);
  await backfillGroupIdOnTransactions();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ✅ Migração Etapa 1 concluída com sucesso!");
  console.log("═══════════════════════════════════════════════════════════\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Erro fatal:", err.message);
  process.exit(1);
});
