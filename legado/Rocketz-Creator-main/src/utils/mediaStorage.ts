import { useState, useEffect } from 'react';

// IndexedDB Helper to handle large video/media file uploads without exceeding Firestore 1MB document limits

const DB_NAME = 'AppMediaStorageDB';
const STORE_NAME = 'mediaFiles';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveMediaToIDB(key: string, data: Blob | File | string): Promise<string> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(data, key);
      req.onsuccess = () => resolve(`idb:${key}`);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error saving media to IndexedDB:', err);
    throw err;
  }
}

export async function getMediaFromIDB(key: string): Promise<Blob | string | null> {
  try {
    const cleanKey = key.startsWith('idb:') ? key.replace('idb:', '') : key;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error reading media from IndexedDB:', err);
    return null;
  }
}

/**
 * Resolves a media string (which can be a http link, base64 data URL, or idb: key)
 * into a renderable URL (e.g., Blob URL or standard HTTP link).
 */
export async function resolveMediaUrl(urlOrKey: string): Promise<string> {
  if (!urlOrKey) return '';
  if (urlOrKey.startsWith('idb:')) {
    const media = await getMediaFromIDB(urlOrKey);
    if (media && typeof media === 'object' && 'size' in media) {
      return URL.createObjectURL(media as Blob);
    }
    if (typeof media === 'string' && media.length > 0) {
      return media;
    }
  }
  return urlOrKey;
}

/**
 * Prepares a file/data string for Firestore submission.
 * If data is > 400KB, stores in IndexedDB and returns `idb:<key>`.
 */
export async function prepareMediaForStorage(fileOrDataUrl: File | string, itemId: string): Promise<string> {
  if (typeof fileOrDataUrl !== 'string') {
    const file = fileOrDataUrl;
    if (file.size > 400 * 1024) {
      const key = `media_${itemId}_${Date.now()}`;
      return await saveMediaToIDB(key, file);
    }
    // If small file, convert to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  } else {
    const dataUrl = fileOrDataUrl;
    if (dataUrl.startsWith('data:') && dataUrl.length > 400000) {
      const key = `media_${itemId}_${Date.now()}`;
      return await saveMediaToIDB(key, dataUrl);
    }
    return dataUrl;
  }
}

export function useResolvedMediaUrl(urlOrKey?: string) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!urlOrKey) {
      setResolvedUrl('');
      return;
    }
    if (!urlOrKey.startsWith('idb:')) {
      setResolvedUrl(urlOrKey);
      return;
    }
    let isMounted = true;
    setLoading(true);
    resolveMediaUrl(urlOrKey).then((url) => {
      if (isMounted) {
        setResolvedUrl(url);
        setLoading(false);
      }
    }).catch(() => {
      if (isMounted) setLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, [urlOrKey]);

  return { resolvedUrl, loading };
}

