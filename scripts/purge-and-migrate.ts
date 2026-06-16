import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Caminho para a credencial do Firebase Admin (considerando execução a partir da raiz do projeto)
const SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  console.error(`[ERRO CRÍTICO] Credencial não encontrada em: ${SERVICE_ACCOUNT_PATH}`);
  console.error("Certifique-se de que o arquivo 'serviceAccountKey.json' está na mesma pasta onde você rodou o comando.");
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

// UIDs oficiais definitivos
const UIDS = {
  ARTHUR: '2zOdH7Ry6oNcu9KAICbrExhUlnG3',
  ZARA: 'frOMwJQLWnhGLdps0kgHJk68En92'
};

const LEGACY_COUPLE_ID = 'arthur-namorada-2026';

async function runMigration() {
  console.log('🚀 Iniciando Migração e Expurgo para SaaS Multi-Tenant...');
  
  try {
    const coupleRef = db.collection('couples').doc(LEGACY_COUPLE_ID);
    const coupleDoc = await coupleRef.get();
    
    if (!coupleDoc.exists) {
      console.log(`⚠️ Documento legado não encontrado em couples/${LEGACY_COUPLE_ID}. Ele pode já ter sido migrado ou apagado.`);
    }

    const legacyData = coupleDoc.exists ? coupleDoc.data() : { name: "Grupo Arthur e Zara" };
    const newGroupRef = db.collection('groups').doc(LEGACY_COUPLE_ID);
    
    // 1. Criar a Raiz do Grupo Corretamente
    console.log(`\n📦 [Etapa 1] Criando grupo raiz em groups/${LEGACY_COUPLE_ID}...`);
    await newGroupRef.set({
      name: legacyData?.name || "Grupo Arthur e Zara",
      createdAt: legacyData?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: UIDS.ARTHUR,
      type: 'standard',
      memberIds: [UIDS.ARTHUR, UIDS.ZARA]
    }, { merge: true });
    console.log(`✅ Raiz do grupo criada. memberIds populado.`);

    // 2. Criar a Subcoleção members
    console.log('\n👥 [Etapa 2] Injetando membros com role admin...');
    await newGroupRef.collection('members').doc(UIDS.ARTHUR).set({
      userId: UIDS.ARTHUR,
      name: 'Arthur',
      email: 'arthurfalcao16@gmail.com',
      role: 'admin',
      status: 'active',
      joinedAt: FieldValue.serverTimestamp()
    });
    console.log(`  -> Membro injetado: Arthur (${UIDS.ARTHUR})`);

    await newGroupRef.collection('members').doc(UIDS.ZARA).set({
      userId: UIDS.ZARA,
      name: 'Zara',
      email: 'euzaritamartins@gmail.com',
      role: 'admin',
      status: 'active',
      joinedAt: FieldValue.serverTimestamp()
    });
    console.log(`  -> Membro injetado: Zara (${UIDS.ZARA})`);

    // 3. Migração Financeira (Transações)
    console.log('\n💸 [Etapa 3] Buscando transações legadas...');
    const transactionsSnap = await coupleRef.collection('transactions').get();
    
    if (transactionsSnap.empty) {
      console.log('ℹ️ Nenhuma transação legada encontrada na subcoleção antiga.');
    } else {
      console.log(`🔄 Migrando ${transactionsSnap.size} transações para o novo formato SaaS...`);
      let batch = db.batch();
      let count = 0;

      for (const txDoc of transactionsSnap.docs) {
        const data = txDoc.data();
        let visibility = 'shared';
        let personalOwnerUserId: string | null = null;

        // Regras estritas de conversão (splitType e pixDestination)
        if (data.splitType === '100% owner') {
          personalOwnerUserId = UIDS.ARTHUR;
          visibility = 'personal';
        } else if (data.splitType === '100% partner' || data.pixDestination === 'zara_card') {
          personalOwnerUserId = UIDS.ZARA;
          visibility = 'personal';
        }

        const newTxRef = newGroupRef.collection('transactions').doc(txDoc.id);
        
        batch.set(newTxRef, {
          ...data,
          visibility,
          personalOwnerUserId,
        }, { merge: true });

        count++;

        // Controle do batch limit (Firebase Firestore limita a 500 por batch)
        if (count % 400 === 0) {
          await batch.commit();
          batch = db.batch();
          console.log(`  -> Commit parcial de ${count} transações gravadas...`);
        }
      }

      if (count % 400 !== 0) {
        await batch.commit();
      }
      
      console.log(`✅ Todas as ${count} transações foram convertidas e vinculadas aos UIDs.`);
    }

    console.log('\n🎉 MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('O GroupHub agora encontrará a relação no memberIds e o frontend assumirá os gastos baseados em personalOwnerUserId.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO CRÍTICO NA MIGRAÇÃO:', error);
    process.exit(1);
  }
}

runMigration();
