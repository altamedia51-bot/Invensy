import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserData {
  uid: string;
  email: string;
  name: string;
  role: 'admin' | 'petugas';
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userData: null, loading: true });

const RUNTIME_ADMIN_EMAIL = 'altamedia51@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(true); // Set loading to true while fetching user data
        try {
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            setUserData({ uid: firebaseUser.uid, ...userDoc.data() } as UserData);
          } else {
            // Create user
            const role = firebaseUser.email === RUNTIME_ADMIN_EMAIL ? 'admin' : 'petugas';
            const newUserData = {
              name: firebaseUser.displayName || 'Unknown Name',
              email: firebaseUser.email || '',
              role,
              createdAt: serverTimestamp(),
            };
            await setDoc(userDocRef, newUserData);
            setUserData({ uid: firebaseUser.uid, ...newUserData } as UserData);
          }
        } catch (error) {
          console.error("Error fetching/creating user data:", error);
          setUserData(null);
          auth.signOut(); // Sign out if user creation fails
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
