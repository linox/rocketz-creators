import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const ADMIN_EMAILS = [
  'diogo@digitalrocket.com.br',
  'admin@rocketz.com.br',
  'diogo.rocketbr@gmail.com',
  'larissa@rocketzmkt.com.br'
];

async function runReset() {
  console.log("Iniciando limpeza do banco de dados...");

  // 1. Clear Creators (preserving admins)
  try {
    console.log("Lendo criadores...");
    const creatorsSnap = await getDocs(collection(db, 'creators'));
    let creatorsDeleted = 0;
    const adminEmailsLower = ADMIN_EMAILS.map(e => e.toLowerCase());

    for (const d of creatorsSnap.docs) {
      const data = d.data();
      const isDocAdmin = data.role === 'admin' || (data.email && adminEmailsLower.includes(data.email.toLowerCase()));
      if (isDocAdmin) {
        console.log(`Preservando admin: ${data.fullName || data.email || d.id}`);
        continue;
      }
      await deleteDoc(doc(db, 'creators', d.id));
      creatorsDeleted++;
    }
    console.log(`Criadores excluídos: ${creatorsDeleted}`);
  } catch (err: any) {
    console.error("Erro ao limpar criadores:", err.message);
  }

  // 2. Clear Campaigns and subcollections
  try {
    console.log("Lendo campanhas...");
    const campSnap = await getDocs(collection(db, 'campaigns'));
    let campDeleted = 0;
    let subCreatorsDeleted = 0;

    for (const c of campSnap.docs) {
      try {
        const subSnap = await getDocs(collection(db, `campaigns/${c.id}/creators`));
        for (const sc of subSnap.docs) {
          await deleteDoc(doc(db, `campaigns/${c.id}/creators`, sc.id));
          subCreatorsDeleted++;
        }
      } catch (e: any) {
        console.warn(`Erro nas sub-entregas de ${c.id}:`, e.message);
      }
      await deleteDoc(doc(db, 'campaigns', c.id));
      campDeleted++;
    }
    console.log(`Campanhas excluídas: ${campDeleted} (com ${subCreatorsDeleted} alocações internas)`);
  } catch (err: any) {
    console.error("Erro ao limpar campanhas:", err.message);
  }

  // 3. Clear global campaignCreators
  try {
    const gcSnap = await getDocs(collection(db, 'campaignCreators'));
    let gcDeleted = 0;
    for (const gc of gcSnap.docs) {
      await deleteDoc(doc(db, 'campaignCreators', gc.id));
      gcDeleted++;
    }
    if (gcDeleted > 0) {
      console.log(`Alocações globais de campanha excluídas: ${gcDeleted}`);
    }
  } catch (err: any) {
    console.error("Erro ao limpar campaignCreators:", err.message);
  }

  // 4. Clear Recurring Contracts
  try {
    console.log("Lendo contratos recorrentes...");
    const recSnap = await getDocs(collection(db, 'recurringContracts'));
    let recDeleted = 0;
    for (const r of recSnap.docs) {
      await deleteDoc(doc(db, 'recurringContracts', r.id));
      recDeleted++;
    }
    console.log(`Contratos recorrentes excluídos: ${recDeleted}`);
  } catch (err: any) {
    console.error("Erro ao limpar contratos recorrentes:", err.message);
  }

  // 5. Clear Content Planning
  try {
    const planSnap = await getDocs(collection(db, 'contentPlanning'));
    let planDeleted = 0;
    for (const p of planSnap.docs) {
      await deleteDoc(doc(db, 'contentPlanning', p.id));
      planDeleted++;
    }
    if (planDeleted > 0) {
      console.log(`Itens de planejamento de conteúdo excluídos: ${planDeleted}`);
    }
  } catch (err: any) {
    console.error("Erro ao limpar contentPlanning:", err.message);
  }

  console.log("Limpeza concluída com sucesso!");
  process.exit(0);
}

runReset().catch(e => {
  console.error("Falha no script de limpeza:", e);
  process.exit(1);
});
