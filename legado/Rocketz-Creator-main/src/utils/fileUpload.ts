/**
 * Reusable utility to upload files in chunks to the backend server (/api/upload-chunk).
 * Supports automatic server-side video transcoding to web-compatible MP4 with H.264 / AAC.
 */

export interface UploadResult {
  url: string;
  filename: string;
  originalName?: string;
  size?: number;
  compressed?: boolean;
}

export async function uploadFileInChunks(
  file: File,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = Date.now() + '-' + Math.round(Math.random() * 1e9);

  for (let index = 0; index < totalChunks; index++) {
    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', index.toString());
    formData.append('totalChunks', totalChunks.toString());
    formData.append('uploadId', uploadId);
    formData.append('filename', file.name);

    const response = await fetch('/api/upload-chunk', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let errMsg = `Falha no envio da parte ${index + 1} de ${totalChunks}.`;
      try {
        const errData = await response.json();
        if (errData && errData.error) {
          errMsg = errData.error;
        }
      } catch (_) {}
      throw new Error(errMsg);
    }

    const progressPercent = Math.round(((index + 1) / totalChunks) * 100);

    if (onProgress) {
      if (index === totalChunks - 1) {
        onProgress(95); // Wait for server to finish merging and encoding video
      } else {
        onProgress(Math.min(progressPercent, 90));
      }
    }

    if (index === totalChunks - 1) {
      const result: UploadResult = await response.json();
      if (onProgress) onProgress(100);
      return result;
    }
  }

  throw new Error('Falha ao concluir o upload em partes.');
}
