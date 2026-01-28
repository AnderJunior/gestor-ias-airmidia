export type PresentationSessionState = {
  admin: {
    userId: string;
    email?: string | null;
    access_token: string;
    refresh_token: string;
  };
  cliente: {
    userId: string;
    email: string;
  };
  returnTo?: string;
  startedAt: string;
};

const KEY = 'presentationSession';

export function getPresentationSession(): PresentationSessionState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PresentationSessionState;
  } catch {
    return null;
  }
}

export function setPresentationSession(state: PresentationSessionState) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(KEY, JSON.stringify(state));
}

export function clearPresentationSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(KEY);
}

