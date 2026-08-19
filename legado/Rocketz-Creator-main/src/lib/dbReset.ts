import { collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db, ADMIN_EMAILS } from './firebase';

export interface ResetProgress {
  step: string;
  count: number;
  total: number;
}

export interface ResetResult {
  creatorsDeleted: number;
  campaignsDeleted: number;
  campaignCreatorsDeleted: number;
  recurringContractsDeleted: number;
  contentPlanningDeleted: number;
  companiesDeleted: number;
  companyUsersDeleted: number;
}

/**
 * Deletes all content creators from Firestore, preserving Admin accounts.
 */
export async function clearCreators(
  keepAdmins: boolean = true,
  onProgress?: (progress: ResetProgress) => void
): Promise<number> {
  const creatorsSnap = await getDocs(collection(db, 'creators'));
  const docs = creatorsSnap.docs;
  let deletedCount = 0;

  const toDelete: string[] = [];
  const adminEmailsLower = ADMIN_EMAILS.map(e => e.toLowerCase());

  docs.forEach(docSnap => {
    const data = docSnap.data();
    const isDocAdmin = data.role === 'admin' || (data.email && adminEmailsLower.includes(data.email.toLowerCase()));
    
    if (keepAdmins && isDocAdmin) {
      // Keep admin account intact
      return;
    }
    toDelete.push(docSnap.id);
  });

  const total = toDelete.length;
  if (onProgress) onProgress({ step: 'Excluindo criadores...', count: 0, total });

  for (let i = 0; i < toDelete.length; i++) {
    const id = toDelete[i];
    await deleteDoc(doc(db, 'creators', id));
    deletedCount++;
    if (onProgress) onProgress({ step: 'Excluindo criadores...', count: deletedCount, total });
  }

  return deletedCount;
}

/**
 * Deletes all campaigns and their subcollections/allocations.
 */
export async function clearCampaigns(
  onProgress?: (progress: ResetProgress) => void
): Promise<{ campaignsCount: number; campaignCreatorsCount: number }> {
  let campaignsCount = 0;
  let campaignCreatorsCount = 0;

  // 1. Delete all campaigns and subcollection creators
  const campaignsSnap = await getDocs(collection(db, 'campaigns'));
  const totalCampaigns = campaignsSnap.docs.length;
  
  if (onProgress) onProgress({ step: 'Excluindo campanhas...', count: 0, total: totalCampaigns });

  for (const campaignDoc of campaignsSnap.docs) {
    const campaignId = campaignDoc.id;

    // Delete subcollection creators
    try {
      const subCreatorsSnap = await getDocs(collection(db, `campaigns/${campaignId}/creators`));
      for (const subDoc of subCreatorsSnap.docs) {
        await deleteDoc(doc(db, `campaigns/${campaignId}/creators`, subDoc.id));
        campaignCreatorsCount++;
      }
    } catch (e) {
      console.warn(`Error deleting subcreators for campaign ${campaignId}:`, e);
    }

    // Delete campaign doc
    await deleteDoc(doc(db, 'campaigns', campaignId));
    campaignsCount++;
    if (onProgress) onProgress({ step: 'Excluindo campanhas...', count: campaignsCount, total: totalCampaigns });
  }

  // 2. Delete global campaignCreators if any exist
  try {
    const globalCcSnap = await getDocs(collection(db, 'campaignCreators'));
    for (const globalDoc of globalCcSnap.docs) {
      await deleteDoc(doc(db, 'campaignCreators', globalDoc.id));
      campaignCreatorsCount++;
    }
  } catch (e) {
    console.warn('Error deleting global campaignCreators:', e);
  }

  return { campaignsCount, campaignCreatorsCount };
}

/**
 * Deletes all recurring contracts and monthly content planning items.
 */
export async function clearRecurringContracts(
  onProgress?: (progress: ResetProgress) => void
): Promise<{ recurringCount: number; planningCount: number }> {
  let recurringCount = 0;
  let planningCount = 0;

  // 1. Delete all recurringContracts
  const recurringSnap = await getDocs(collection(db, 'recurringContracts'));
  const totalRecurring = recurringSnap.docs.length;

  if (onProgress) onProgress({ step: 'Excluindo contratos recorrentes...', count: 0, total: totalRecurring });

  for (const rDoc of recurringSnap.docs) {
    await deleteDoc(doc(db, 'recurringContracts', rDoc.id));
    recurringCount++;
    if (onProgress) onProgress({ step: 'Excluindo contratos recorrentes...', count: recurringCount, total: totalRecurring });
  }

  // 2. Delete all contentPlanning documents
  try {
    const planningSnap = await getDocs(collection(db, 'contentPlanning'));
    for (const pDoc of planningSnap.docs) {
      await deleteDoc(doc(db, 'contentPlanning', pDoc.id));
      planningCount++;
    }
  } catch (e) {
    console.warn('Error deleting contentPlanning:', e);
  }

  return { recurringCount, planningCount };
}

/**
 * Deletes all companies and company users.
 */
export async function clearCompanies(
  onProgress?: (progress: ResetProgress) => void
): Promise<{ companiesCount: number; companyUsersCount: number }> {
  let companiesCount = 0;
  let companyUsersCount = 0;

  // 1. Delete all companies
  const compSnap = await getDocs(collection(db, 'companies'));
  const totalComp = compSnap.docs.length;

  if (onProgress) onProgress({ step: 'Excluindo empresas...', count: 0, total: totalComp });

  for (const cDoc of compSnap.docs) {
    await deleteDoc(doc(db, 'companies', cDoc.id));
    companiesCount++;
    if (onProgress) onProgress({ step: 'Excluindo empresas...', count: companiesCount, total: totalComp });
  }

  // 2. Delete all company users
  try {
    const compUsersSnap = await getDocs(collection(db, 'companyUsers'));
    for (const cuDoc of compUsersSnap.docs) {
      await deleteDoc(doc(db, 'companyUsers', cuDoc.id));
      companyUsersCount++;
    }
  } catch (e) {
    console.warn('Error deleting companyUsers:', e);
  }

  return { companiesCount, companyUsersCount };
}

/**
 * Clears creators, campaigns, recurring contracts, and companies all together.
 */
export async function clearDatabaseAll(
  keepAdmins: boolean = true,
  onProgress?: (progress: ResetProgress) => void
): Promise<ResetResult> {
  const creatorsDeleted = await clearCreators(keepAdmins, onProgress);
  const { campaignsCount, campaignCreatorsCount } = await clearCampaigns(onProgress);
  const { recurringCount, planningCount } = await clearRecurringContracts(onProgress);
  const { companiesCount, companyUsersCount } = await clearCompanies(onProgress);

  return {
    creatorsDeleted,
    campaignsDeleted: campaignsCount,
    campaignCreatorsDeleted: campaignCreatorsCount,
    recurringContractsDeleted: recurringCount,
    contentPlanningDeleted: planningCount,
    companiesDeleted: companiesCount,
    companyUsersDeleted: companyUsersCount
  };
}
