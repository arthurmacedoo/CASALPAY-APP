/**
 * scripts/migrate-to-groups.ts
 *
 * Script de migração idempotente: Etapa 1
 * ─────────────────────────────────────────────────────────────────────────────
 * O que faz:
 *  1. Lê os UIDs reais de Arthur e Zara do campo `members` em couples/{coupleId}
 *  2. Cria o documento groups/{groupId} com name "Grupo Arthur e Zara" (se não existir)
 *  3. Cria/atualiza members/{uid} na subcoleção do grupo para Arthur e Zara
 *  4. Cria/atualiza users/{uid} com activeGroupId e defaultGroupId
 *  5. Adiciona campo `groupId` nos documentos de transactions que ainda não têm
 *
 * O que NÃO faz (Etapa 1.5 futura):
 *  - Mover fisicamente transactions para groups/{groupId}/transactions
 *  - Mover apple_pay_events ou fcm_tokens
 *  - Alterar caminhos usados pelo webhook Apple Pay
 *
 * Idempotência:
 *  - Usa set({ merge: true }) — rodar 2x não duplica documentos
 *  - Só atualiza transactions sem groupId (verifica antes de escrever)
 *  - Imprime resumo claro ao final
 *
 * Uso:
 *   npx ts-node --esm scripts/migrate-to-groups.ts
 *   ou: node --env-file=.env.local scripts/migrate-to-groups.js  (compilado)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

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

const db = getFirestore();

// ── Configuração ─────────────────────────────────────────────────────────────
const COUPLE_ID  = process.env.VITE_COUPLE_ID ?? "arthur-namorada-2026";
const GROUP_ID   = COUPLE_ID; // Mesmo ID durante Etapa 1 — simplifica compatibilidade
const GROUP_NAME = "Grupo Arthur e Zara";

// Mapeamento de nomes legados (retrocompat com deviceUser "Arthur"/"Zara")
const MEMBER_NAMES: Record<string, string> = {
  arthur: "Arthur",
  zara:   "Zara",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function inferNameFromEmail(email: string): string {
  const prefix = email.split("@")[0].toLowerCase();
  for (const [key, name] of Object.entries(MEMBER_NAMES)) {
    if (prefix.includes(key)) return name;
  }
  // Não conseguiu inferir — retorna o próprio prefix capitalizado
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

// ── Passo 1: Lê UIDs de couples/{coupleId}.members ───────────────────────────
async function readMembersFromCouple(): Promise<Record<string, true>> {
  console.log(`\n📋 [Passo 1] Lendo membros de couples/${COUPLE_ID}...`);

  const coupleSnap = await db.collection("couples").doc(COUPLE_ID).get();

  if (!coupleSnap.exists) {
    console.error(`❌ Documento couples/${COUPLE_ID} não encontrado no Firestore.`);
    console.error("   Verifique se VITE_COUPLE_ID está correto no .env.local");
    process.exit(1);
  }

  const data = coupleSnap.data()!;
  const members = data.members as Record<string, unknown> | undefined;

  if (!members || typeof members !== "object") {
    console.error("❌ Campo 'members' não encontrado ou inválido no documento do casal.");
    console.error("   Campos encontrados:", Object.keys(data).join(", "));
    process.exit(1);
  }

  const uids = Object.entries(members)
    .filter(([, v]) => v === true)
    .map(([uid]) => uid);

  if (uids.length === 0) {
    console.error("❌ Nenhum UID com valor true encontrado em members.");
    console.error("   Conteúdo de members:", JSON.stringify(members, null, 2));
    process.exit(1);
  }

  console.log(`   ✅ UIDs encontrados: ${uids.join(", ")}`);
  return members as Record<string, true>;
}

// ── Passo 2: Busca emails dos UIDs no Firebase Auth via Firestore lookup ──────
// Nota: Firebase Admin SDK precisa de firebase-admin/auth para buscar por UID.
// Usamos uma abordagem alternativa: busca em users/{uid} se já existir,
// ou usa email derivado do UID como fallback (não-bloqueante).
async function resolveUserEmails(
  uids: string[]
): Promise<Array<{ uid: string; email: string; name: string }>> {
  console.log(`\n📋 [Passo 2] Resolvendo emails dos UIDs...`);

  const { getAuth } = await import("firebase-admin/auth");
  const auth = getAuth();

  const result: Array<{ uid: string; email: string; name: string }> = [];

  for (const uid of uids) {
    try {
      const userRecord = await auth.getUser(uid);
      const email = userRecord.email ?? `${uid}@casalpay.local`;
      const name = userRecord.displayName ?? inferNameFromEmail(email);
      console.log(`   ✅ UID ${uid} → ${name} <${email}>`);
      result.push({ uid, email, name });
    } catch (err) {
      console.warn(`   ⚠️  Não foi possível buscar UID ${uid} no Firebase Auth:`, err);
      // Usa fallback não-bloqueante
      result.push({ uid, email: `${uid}@casalpay.local`, name: `Usuário ${uid.slice(0, 6)}` });
    }
  }

  return result;
}

// ── Passo 3: Cria/atualiza o documento do grupo ───────────────────────────────
async function ensureGroupDocument(createdByUid: string): Promise<void> {
  console.log(`\n📋 [Passo 3] Criando/verificando groups/${GROUP_ID}...`);

  const groupRef = db.collection("groups").doc(GROUP_ID);
  const snap = await groupRef.get();

  if (snap.exists) {
    console.log(`   ✅ Grupo já existe (idempotente): "${snap.data()?.name}"`);
    // Atualiza updatedAt mas mantém tudo mais
    await groupRef.set(
      { updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  } else {
    await groupRef.set({
      name:           GROUP_NAME,
      createdBy:      createdByUid,
      createdAt:      FieldValue.serverTimestamp(),
      updatedAt:      FieldValue.serverTimestamp(),
      legacyCoupleId: COUPLE_ID,
      // Nota arquitetural: legacyCoupleId será removido na Etapa 1.5
      // após migração de transactions/apple_pay_events/fcm_tokens para
      // groups/{groupId}/...
    });
    console.log(`   ✅ Grupo criado: "${GROUP_NAME}" (id: ${GROUP_ID})`);
  }
}

// ── Passo 4: Cria/atualiza membros do grupo ───────────────────────────────────
async function ensureGroupMembers(
  users: Array<{ uid: string; email: string; name: string }>
): Promise<void> {
  console.log(`\n📋 [Passo 4] Criando/verificando membros em groups/${GROUP_ID}/members/...`);

  for (const { uid, email, name } of users) {
    const memberRef = db
      .collection("groups")
      .doc(GROUP_ID)
      .collection("members")
      .doc(uid);

    await memberRef.set(
      {
        userId:   uid,
        name,
        email,
        role:     "admin",  // Arthur e Zara são admins do grupo inicial
        status:   "active",
        joinedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`   ✅ Membro upsert: ${name} (${uid})`);
  }
}

// ── Passo 5: Cria/atualiza perfis em users/{uid} ─────────────────────────────
async function ensureUserProfiles(
  users: Array<{ uid: string; email: string; name: string }>
): Promise<void> {
  console.log(`\n📋 [Passo 5] Criando/verificando perfis em users/{uid}...`);

  for (const { uid, email, name } of users) {
    const userRef = db.collection("users").doc(uid);

    await userRef.set(
      {
        userId:          uid,
        name,
        email,
        activeGroupId:   GROUP_ID,
        defaultGroupId:  GROUP_ID,
        updatedAt:       FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`   ✅ Perfil upsert: ${name} → activeGroupId="${GROUP_ID}"`);
  }
}

// ── Passo 6: Adiciona groupId nas transactions que ainda não têm ──────────────
// Nota Etapa 1.5: este passo apenas ANOTA o groupId como campo.
// A migração física para groups/{groupId}/transactions ocorrerá na Etapa 1.5.
async function backfillGroupIdOnTransactions(): Promise<void> {
  console.log(`\n📋 [Passo 6] Adicionando groupId nas transações sem esse campo...`);

  const txRef = db.collection("couples").doc(COUPLE_ID).collection("transactions");
  const snap  = await txRef.get();

  if (snap.empty) {
    console.log("   ℹ️  Nenhuma transação encontrada.");
    return;
  }

  let updated   = 0;
  let skipped   = 0;
  const batchSize = 450; // Limite seguro abaixo do máximo de 500 do Firestore
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (data.groupId) {
      skipped++;
      continue; // Idempotente: já tem groupId
    }

    batch.update(docSnap.ref, {
      groupId:   GROUP_ID,
      updatedAt: FieldValue.serverTimestamp(),
    });

    updated++;
    batchCount++;

    if (batchCount >= batchSize) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
      console.log(`   ... commit parcial (${updated} até agora)`);
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`   ✅ ${updated} transação(ões) atualizadas, ${skipped} já tinham groupId.`);
  console.log(`   ⚠️  NOTA: dados ainda em couples/${COUPLE_ID}/transactions (legado).`);
  console.log(`           Migração física → groups/${GROUP_ID}/transactions na Etapa 1.5.`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CasalPay — Script de Migração: Etapa 1 (Grupo Inicial)  ");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  COUPLE_ID : ${COUPLE_ID}`);
  console.log(`  GROUP_ID  : ${GROUP_ID}`);
  console.log(`  GROUP_NAME: ${GROUP_NAME}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // 1. Lê UIDs de couples/{coupleId}.members (para com erro se não encontrar)
  const membersMap = await readMembersFromCouple();
  const uids = Object.keys(membersMap).filter((k) => membersMap[k] === true);

  // 2. Resolve emails via Firebase Auth
  const users = await resolveUserEmails(uids);

  // 3. Grupo
  await ensureGroupDocument(uids[0]);

  // 4. Membros do grupo
  await ensureGroupMembers(users);

  // 5. Perfis users/{uid}
  await ensureUserProfiles(users);

  // 6. Backfill groupId nas transações legadas
  await backfillGroupIdOnTransactions();

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ✅ Migração Etapa 1 concluída com sucesso!               ");
  console.log("  Próximo passo: rodar o app local e verificar o contexto  ");
  console.log("  de grupo em useGroupContext() → group.name deve ser:     ");
  console.log(`  "${GROUP_NAME}"`);
  console.log("═══════════════════════════════════════════════════════════\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Erro fatal na migração:", err);
  process.exit(1);
});
