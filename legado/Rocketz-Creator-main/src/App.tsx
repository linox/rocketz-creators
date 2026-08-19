import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle } from './lib/firebase';
import AppLayout from './components/AppLayout';

import Dashboard from './pages/Dashboard';
import Creators from './pages/Creators';
import CreatorProfile from './pages/CreatorProfile';
import Companies from './pages/Companies';
import Campaigns from './pages/Campaigns';
import CampaignDetail from './pages/CampaignDetail';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Notifications from './pages/Notifications';
import CompanyDashboard from './pages/CompanyDashboard';
import CampaignDeliveries from './pages/CampaignDeliveries';
import RecurringContracts from './pages/RecurringContracts';
import RecurringProjectDetail from './pages/RecurringProjectDetail';
import AdminUsers from './pages/AdminUsers';
import AvailableCampaigns from './pages/AvailableCampaigns';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<'admin' | 'creator' | 'company' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      if (unsubDoc) {
        unsubDoc();
        unsubDoc = undefined;
      }

      if (u) {
        const { isAdminEmail } = await import('./lib/firebase');
        if (isAdminEmail(u.email)) {
          setRole('admin');
          setLoading(false);
        } else {
          const { doc, getDoc, onSnapshot, collection, query, where, getDocs, setDoc } = await import('firebase/firestore');
          const { db } = await import('./lib/firebase');
          
          try {
            // Check company user by UID first
            const companyUserSnap = await getDoc(doc(db, 'companyUsers', u.uid));
            if (companyUserSnap.exists()) {
              setRole('company');
              setLoading(false);
              return;
            }

            // Also check company user by email
            if (u.email) {
              const compQ = query(collection(db, 'companyUsers'), where('email', '==', u.email.trim().toLowerCase()));
              const compSnap = await getDocs(compQ);
              if (!compSnap.empty) {
                const compData = compSnap.docs[0].data();
                // Ensure document exists at doc(db, 'companyUsers', u.uid)
                if (compSnap.docs[0].id !== u.uid) {
                  try {
                    await setDoc(doc(db, 'companyUsers', u.uid), {
                      ...compData,
                      uid: u.uid
                    }, { merge: true });
                  } catch (syncErr) {
                    console.warn("Could not sync companyUser doc UID:", syncErr);
                  }
                }
                setRole('company');
                setLoading(false);
                return;
              }
            }
          } catch (err) {
            console.error("Error checking company user:", err);
          }

          // Listen to creators/{uid} document for role
          unsubDoc = onSnapshot(doc(db, 'creators', u.uid), (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setRole(data.role === 'admin' ? 'admin' : 'creator');
            } else {
              setRole('creator');
            }
            setLoading(false);
          }, (err) => {
            console.error("Error listening to user document:", err);
            setRole('creator');
            setLoading(false);
          });
        }
      } else {
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubDoc) unsubDoc();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout role={role}>
        <Routes>
          {!user ? (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/join" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : role === 'creator' ? (
            <>
              <Route path="/available-campaigns" element={<AvailableCampaigns />} />
              <Route path="/creators/:id" element={<CreatorProfile />} />
              <Route path="/recurring" element={<RecurringContracts />} />
              <Route path="/recurring/:id" element={<RecurringProjectDetail />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/join" element={<LandingPage />} />
              <Route path="*" element={<Navigate to={`/creators/${user.uid}`} replace />} />
            </>
          ) : role === 'company' ? (
            <>
              <Route path="/company-dashboard" element={<CompanyDashboard />} />
              <Route path="/available-campaigns" element={<AvailableCampaigns />} />
              <Route path="/recurring" element={<RecurringContracts />} />
              <Route path="/recurring/:id" element={<RecurringProjectDetail />} />
              <Route path="/campaign-deliveries" element={<CampaignDeliveries />} />
              <Route path="/creators/:id" element={<CreatorProfile />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/join" element={<LandingPage />} />
              <Route path="*" element={<Navigate to="/company-dashboard" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/available-campaigns" element={<AvailableCampaigns />} />
              <Route path="/join" element={<LandingPage />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/creators" element={<Creators />} />
              <Route path="/creators/:id" element={<CreatorProfile />} />
              <Route path="/companies" element={<Companies />} />
              <Route path="/company-dashboard" element={<CompanyDashboard />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/campaigns/:id" element={<CampaignDetail />} />
              <Route path="/recurring" element={<RecurringContracts />} />
              <Route path="/recurring/:id" element={<RecurringProjectDetail />} />
              <Route path="/campaign-deliveries" element={<CampaignDeliveries />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/admin-users" element={<AdminUsers />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
