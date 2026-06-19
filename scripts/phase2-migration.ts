import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, "../serviceAccountKey.json");
if (!fs.existsSync(serviceAccountPath)) {
  console.error("serviceAccountKey.json não encontrado na raiz!");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const groupId = "arthur-namorada-2026";

async function migrate() {
  console.log(`[FASE 2] Iniciando migração e higienização física no grupo: ${groupId}...`);
  
  // Obter o documento do grupo para descobrir os UIDs
  const groupDoc = await db.collection("groups").doc(groupId).get();
  if (!groupDoc.exists) {
    throw new Error("Grupo não encontrado.");
  }
  const groupData = groupDoc.data()!;
  const adminUid = groupData.createdBy;
  const memberIds = groupData.memberIds || [];
  
  const UID_ARTHUR = adminUid;
  const UID_ZARA = memberIds.find((id: string) => id !== adminUid);
  
  if (!UID_ARTHUR || !UID_ZARA) {
    throw new Error("Não foi possível identificar os membros Arthur e Zara a partir do documento do grupo.");
  }

  console.log(`UID_ARTHUR (admin) resolvido: ${UID_ARTHUR}`);
  console.log(`UID_ZARA (partner) resolvido: ${UID_ZARA}`);

  const snapshot = await db.collection("groups").doc(groupId).collection("transactions").get();
  
  const batch = db.batch();
  let count = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const updateData: any = {};
    let needsUpdate = false;

    const pb = (data.paidBy || "").toLowerCase();
    const fr = (data.from || "").toLowerCase();
    const toStr = (data.to || "").toLowerCase();
    const splitType = (data.splitType || "").toLowerCase();
    const pixDest = (data.pixDestination || "").toLowerCase();

    // Regras de Transação (Expense)
    if (data.type === "expense") {
      // Regra: Quem pagou?
      if (!data.paidByUserId) {
        if (pb === "partner" || pb === "zara") {
          updateData.paidByUserId = UID_ZARA;
          needsUpdate = true;
        } else if (pb === "owner" || pb === "arthur") {
          updateData.paidByUserId = UID_ARTHUR;
          needsUpdate = true;
        }
      }

      // Identificação agressiva de gastos da parceira
      const isPartnerExpense = 
        splitType.includes("partner") || 
        splitType.includes("zara") || 
        splitType.includes("namorada") || 
        splitType.includes("gasto pessoal") ||
        pixDest === "zara_card" ||
        pb === "partner" ||
        pb === "zara";

      // Identificação agressiva de gastos do admin
      const isAdminExpense = 
        splitType.includes("owner") || 
        splitType.includes("arthur") || 
        splitType === "100% owner";

      if (isPartnerExpense) {
        updateData.visibility = "personal";
        updateData.personalOwnerUserId = UID_ZARA;
        updateData.splitMode = "personal";
        needsUpdate = true;
      } else if (isAdminExpense) {
        updateData.visibility = "personal";
        updateData.personalOwnerUserId = UID_ARTHUR;
        updateData.splitMode = "personal";
        needsUpdate = true;
      } else {
        updateData.visibility = "shared";
        // Convert array se for equal e não existir
        if (!data.splitBetweenUserIds) {
          updateData.splitBetweenUserIds = [UID_ARTHUR, UID_ZARA];
        }
        updateData.splitMode = "equal";
        needsUpdate = true;
      }
    } else if (data.type === "settlement") {
      // Regras de Settlement
      if (pixDest === "zara_card") {
        updateData.visibility = "personal";
        updateData.personalOwnerUserId = UID_ZARA;
        needsUpdate = true;
      } else {
        updateData.visibility = "shared";
        needsUpdate = true;
      }
      
      if (!data.fromUserId) {
        if (fr === "partner" || fr === "zara" || fr === "namorada") {
          updateData.fromUserId = UID_ZARA;
          needsUpdate = true;
        } else if (fr === "owner" || fr === "arthur") {
          updateData.fromUserId = UID_ARTHUR;
          needsUpdate = true;
        }
      }
      
      if (!data.toUserId) {
        if (toStr === "partner" || toStr === "zara" || toStr === "namorada") {
          updateData.toUserId = UID_ZARA;
          needsUpdate = true;
        } else if (toStr === "owner" || toStr === "arthur") {
          updateData.toUserId = UID_ARTHUR;
          needsUpdate = true;
        }
      }
    }

    // Removendo campos obsoletos
    if ("paidBy" in data) { updateData.paidBy = FieldValue.delete(); needsUpdate = true; }
    if ("splitType" in data) { updateData.splitType = FieldValue.delete(); needsUpdate = true; }
    if ("coupleId" in data) { updateData.coupleId = FieldValue.delete(); needsUpdate = true; }
    if ("from" in data) { updateData.from = FieldValue.delete(); needsUpdate = true; }
    if ("to" in data) { updateData.to = FieldValue.delete(); needsUpdate = true; }
    if ("pixDestination" in data) { updateData.pixDestination = FieldValue.delete(); needsUpdate = true; }

    if (needsUpdate) {
      batch.update(doc.ref, updateData);
      count++;
    }
  });

  if (count > 0) {
    console.log(`Atualizando ${count} transações...`);
    await batch.commit();
    console.log(`[FASE 2] Sucesso! Banco higienizado e chaves antigas apagadas.`);
  } else {
    console.log(`[FASE 2] Nenhuma transação legada precisava de atualização.`);
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
