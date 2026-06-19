import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

async function backup() {
  console.log(`[FASE 1] Iniciando backup físico do grupo: ${groupId}...`);
  const snapshot = await db.collection("groups").doc(groupId).collection("transactions").get();
  
  const transactions: any[] = [];
  snapshot.forEach(doc => {
    transactions.push({
      id: doc.id,
      ...doc.data()
    });
  });

  const outPath = path.join(__dirname, "../backup_zara_transactions.json");
  fs.writeFileSync(outPath, JSON.stringify(transactions, null, 2));
  
  console.log(`[FASE 1] Sucesso! ${transactions.length} documentos salvos em: backup_zara_transactions.json`);
  process.exit(0);
}

backup().catch(err => {
  console.error("Erro no backup:", err);
  process.exit(1);
});
