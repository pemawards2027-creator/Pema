import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AdminDepartmentRole, LiveWebsiteContent, UserAccount } from '../types/pema';
import { apiFetch, setAdminToken, setUserToken } from '../utils/api';

export const DEFAULT_OFFICIAL_CREST_URL = '/src/assets/images/pema_emblem_crest_1795064576358.jpg';

interface PemaContextValue {
  liveContent: LiveWebsiteContent | null;
  loadingContent: boolean;
  user: UserAccount | null;
  loadingAuth: boolean;
  isAdmin: boolean;
  adminName: string | null;
  adminDepartment: AdminDepartmentRole | null;
  logoUrl: string;
  eventVersion: number;
  lastEventType: string | null;
  refreshLiveContent: (force?: boolean) => Promise<void>;
  refreshAuth: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<UserAccount | null>>;
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>;
  setAdminName: React.Dispatch<React.SetStateAction<string | null>>;
  setAdminDepartment: React.Dispatch<React.SetStateAction<AdminDepartmentRole | null>>;
  logoutUser: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
}

const PemaContext = createContext<PemaContextValue | undefined>(undefined);

export function PemaProvider({ children }: { children: React.ReactNode }) {
  const [liveContent, setLiveContent] = useState<LiveWebsiteContent | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState<string | null>(null);
  const [adminDepartment, setAdminDepartment] = useState<AdminDepartmentRole | null>(null);
  const [eventVersion, setEventVersion] = useState(0);
  const [lastEventType, setLastEventType] = useState<string | null>(null);

  const refreshLiveContent = useCallback(async (force = false) => {
    try {
      const data = await apiFetch<LiveWebsiteContent>(
        force ? '/api/live-content?refresh=1' : '/api/live-content',
      );
      setLiveContent(data);
    } catch {
      // keep existing if transient failure
    } finally {
      setLoadingContent(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    try {
      const [meRes, adminRes] = await Promise.all([
        apiFetch<{ user: UserAccount | null }>('/api/auth/me'),
        apiFetch<{
          isAdmin: boolean;
          adminName: string | null;
          department: AdminDepartmentRole | null;
        }>('/api/admin/session'),
      ]);
      setUser(meRes.user);
      setIsAdmin(adminRes.isAdmin);
      setAdminName(adminRes.adminName ?? null);
      setAdminDepartment(adminRes.department ?? null);
    } catch {
      setUser(null);
      setIsAdmin(false);
      setAdminName(null);
      setAdminDepartment(null);
    } finally {
      setLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshLiveContent(false);
    refreshAuth();
  }, [refreshLiveContent, refreshAuth]);

  // Real-time Server-Sent Events stream across open views
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return;
    }
    const source = new EventSource('/api/events');
    source.onmessage = (evt) => {
      try {
        const parsed = JSON.parse(evt.data) as { type?: string };
        const evtType = parsed?.type || 'update';
        if (evtType === 'connected') return;
        setLastEventType(evtType);
        setEventVersion((v) => v + 1);
        if (
          evtType === 'settings_updated' ||
          evtType === 'admin_reverted' ||
          evtType === 'support_status_updated'
        ) {
          refreshLiveContent(false);
        }
      } catch {
        // ignore malformed heartbeat/comment frames
      }
    };
    source.onerror = () => {
      // EventSource automatically reconnects cleanly
    };
    return () => {
      source.close();
    };
  }, [refreshLiveContent]);

  const logoutUser = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setUserToken(null);
    setUser(null);
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setAdminToken(null);
    setIsAdmin(false);
    setAdminName(null);
    setAdminDepartment(null);
  }, []);

  const logoUrl = liveContent?.settings?.customLogoUrl || DEFAULT_OFFICIAL_CREST_URL;

  return (
    <PemaContext.Provider
      value={{
        liveContent,
        loadingContent,
        user,
        loadingAuth,
        isAdmin,
        adminName,
        adminDepartment,
        logoUrl,
        eventVersion,
        lastEventType,
        refreshLiveContent,
        refreshAuth,
        setUser,
        setIsAdmin,
        setAdminName,
        setAdminDepartment,
        logoutUser,
        logoutAdmin,
      }}
    >
      {children}
    </PemaContext.Provider>
  );
}

export function usePema() {
  const ctx = useContext(PemaContext);
  if (!ctx) {
    throw new Error('usePema must be used inside PemaProvider');
  }
  return ctx;
}
