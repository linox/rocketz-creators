import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationPayload {
  title: string;
  message: string;
  type: 'application' | 'approval' | 'rejection' | 'delivery_review' | 'contract' | 'general';
  targetRole: 'admin' | 'creator' | 'all';
  creatorId?: string;
  campaignId?: string;
  contractId?: string;
  link?: string;
}

/**
 * Creates a standardized notification in Firestore.
 */
export async function createNotification(payload: NotificationPayload): Promise<string | null> {
  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...payload,
      read: false,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}
