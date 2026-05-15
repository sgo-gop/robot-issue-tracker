import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SessionUser {
  name: string;
  robotType: string;
}

interface SessionContextType {
  user: SessionUser | null;
  setSession: (name: string, robotType: string) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('issueTrackerSession');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        sessionStorage.removeItem('issueTrackerSession');
      }
    }
  }, []);

  const setSession = (name: string, robotType: string) => {
    const sessionUser = { name, robotType };
    setUser(sessionUser);
    sessionStorage.setItem('issueTrackerSession', JSON.stringify(sessionUser));
  };

  const clearSession = () => {
    setUser(null);
    sessionStorage.removeItem('issueTrackerSession');
  };

  return (
    <SessionContext.Provider value={{ user, setSession, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
