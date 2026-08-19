import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ConsentPreferences {
  marketing: boolean;
  analytics: boolean;
  profilePublic: boolean;
}

interface PrivacyContextType {
  hideValues: boolean;
  toggleHideValues: () => void;
  maskValue: (value: string | number) => string;
  formatCurrency: (value: number, overrideShow?: boolean) => string;
  formatNumber: (value: number) => string;
  maskPII: (value: string | undefined | null, type?: 'cpf' | 'cnpj' | 'pix' | 'phone' | 'email' | 'text', forceMask?: boolean) => string;
  lgpdAccepted: boolean;
  acceptLgpd: () => void;
  isLgpdModalOpen: boolean;
  openLgpdModal: () => void;
  closeLgpdModal: () => void;
  consentPreferences: ConsentPreferences;
  updateConsentPreferences: (prefs: Partial<ConsentPreferences>) => void;
}

const PrivacyContext = createContext<PrivacyContextType>({
  hideValues: false,
  toggleHideValues: () => {},
  maskValue: (value) => String(value),
  formatCurrency: (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val),
  formatNumber: (val) => new Intl.NumberFormat('pt-BR').format(val),
  maskPII: (val) => val || '',
  lgpdAccepted: true,
  acceptLgpd: () => {},
  isLgpdModalOpen: false,
  openLgpdModal: () => {},
  closeLgpdModal: () => {},
  consentPreferences: { marketing: true, analytics: true, profilePublic: true },
  updateConsentPreferences: () => {},
});

export const PrivacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hideValues, setHideValues] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rc_hide_values') === 'true';
    } catch {
      return false;
    }
  });

  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rc_lgpd_accepted') === 'true';
    } catch {
      return false;
    }
  });

  const [isLgpdModalOpen, setIsLgpdModalOpen] = useState<boolean>(false);

  const [consentPreferences, setConsentPreferences] = useState<ConsentPreferences>(() => {
    try {
      const saved = localStorage.getItem('rc_lgpd_prefs');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return { marketing: true, analytics: true, profilePublic: true };
  });

  const toggleHideValues = () => {
    setHideValues(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rc_hide_values', String(next));
      } catch (e) {
        console.error('Error saving privacy preference:', e);
      }
      return next;
    });
  };

  const acceptLgpd = () => {
    setLgpdAccepted(true);
    try {
      localStorage.setItem('rc_lgpd_accepted', 'true');
      localStorage.setItem('rc_lgpd_accepted_at', new Date().toISOString());
    } catch (e) {
      console.error('Error saving LGPD consent:', e);
    }
  };

  const updateConsentPreferences = (prefs: Partial<ConsentPreferences>) => {
    setConsentPreferences(prev => {
      const updated = { ...prev, ...prefs };
      try {
        localStorage.setItem('rc_lgpd_prefs', JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving preferences:', e);
      }
      return updated;
    });
  };

  const openLgpdModal = () => setIsLgpdModalOpen(true);
  const closeLgpdModal = () => setIsLgpdModalOpen(false);

  const maskValue = (value: string | number): string => {
    if (!hideValues) return String(value);
    return '••••••';
  };

  const formatCurrency = (value: number, overrideShow = false): string => {
    if (!overrideShow && hideValues) {
      return 'R$ ••••••';
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const maskPII = (
    value: string | undefined | null,
    type: 'cpf' | 'cnpj' | 'pix' | 'phone' | 'email' | 'text' = 'text',
    forceMask = false
  ): string => {
    if (!value) return '';
    if (!hideValues && !forceMask) return value;

    const str = String(value).trim();
    if (type === 'email') {
      const parts = str.split('@');
      if (parts.length === 2) {
        const name = parts[0];
        const domain = parts[1];
        const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : '***';
        return `${maskedName}@${domain}`;
      }
      return '***@***.com';
    }

    if (type === 'phone') {
      if (str.length >= 8) {
        return str.substring(0, 4) + '****-' + str.substring(str.length - 4);
      }
      return '(**) 9****-****';
    }

    if (type === 'cpf') {
      return '***.***.***-**';
    }

    if (type === 'cnpj') {
      return '**.***.***/0001-**';
    }

    if (type === 'pix') {
      if (str.includes('@')) return maskPII(str, 'email', true);
      return str.substring(0, 3) + '••••••••' + str.substring(Math.max(0, str.length - 2));
    }

    return '••••••••';
  };

  return (
    <PrivacyContext.Provider
      value={{
        hideValues,
        toggleHideValues,
        maskValue,
        formatCurrency,
        formatNumber,
        maskPII,
        lgpdAccepted,
        acceptLgpd,
        isLgpdModalOpen,
        openLgpdModal,
        closeLgpdModal,
        consentPreferences,
        updateConsentPreferences,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => useContext(PrivacyContext);
