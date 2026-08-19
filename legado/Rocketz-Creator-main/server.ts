import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { spawn } from "child_process";
import ffmpegStatic from "ffmpeg-static";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Initialize Firebase for persistent server-side media backup
const fbApp = initializeApp(firebaseConfig);
const firestoreDb = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

// Resolve ffmpeg binary path from ffmpeg-static
const ffmpegExec = (ffmpegStatic as any)?.default || ffmpegStatic || "ffmpeg";

// Helper to determine mime type by extension
function getMimeType(filePathOrName: string): string {
  const ext = path.extname(filePathOrName).toLowerCase();
  switch (ext) {
    case ".mp4": return "video/mp4";
    case ".webm": return "video/webm";
    case ".mov": return "video/quicktime";
    case ".m4v": return "video/mp4";
    case ".ogv":
    case ".ogg": return "video/ogg";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".png": return "image/png";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".svg": return "image/svg+xml";
    case ".pdf": return "application/pdf";
    default: return "application/octet-stream";
  }
}

// Backup file to Firestore in ~500KB base64 chunks for persistent cloud availability
async function persistFileToFirestore(filePath: string, filename: string): Promise<boolean> {
  try {
    if (!fs.existsSync(filePath)) return false;
    const fileStats = fs.statSync(filePath);
    const mimeType = getMimeType(filename);
    const buffer = fs.readFileSync(filePath);
    
    // Chunk buffer (500KB binary chunks -> ~667KB base64)
    const BINARY_CHUNK_SIZE = 500 * 1024;
    const totalChunks = Math.ceil(buffer.length / BINARY_CHUNK_SIZE);
    
    console.log(`[Persist] Salvando "${filename}" (${(fileStats.size / (1024 * 1024)).toFixed(2)} MB) no Firestore em ${totalChunks} partes...`);
    
    // Save metadata
    const metaRef = doc(firestoreDb, "media_files", filename);
    await setDoc(metaRef, {
      filename,
      mimeType,
      totalChunks,
      size: fileStats.size,
      createdAt: new Date().toISOString()
    });

    // Save chunks in batches
    for (let i = 0; i < totalChunks; i++) {
      const start = i * BINARY_CHUNK_SIZE;
      const end = Math.min(start + BINARY_CHUNK_SIZE, buffer.length);
      const chunkBuffer = buffer.subarray(start, end);
      const base64Data = chunkBuffer.toString("base64");
      
      const chunkDocRef = doc(firestoreDb, "media_files", filename, "chunks", i.toString());
      await setDoc(chunkDocRef, {
        chunkIndex: i,
        data: base64Data
      });
    }

    console.log(`[Persist] "${filename}" salvo com sucesso no Firestore!`);
    return true;
  } catch (err) {
    console.error(`[Persist Error] Falha ao persistir "${filename}" no Firestore:`, err);
    return false;
  }
}

// Restore file from Firestore if missing from container disk
async function restoreFileFromFirestore(filename: string, targetPath: string): Promise<boolean> {
  try {
    const metaRef = doc(firestoreDb, "media_files", filename);
    const metaSnap = await getDoc(metaRef);
    if (!metaSnap.exists()) {
      return false;
    }

    const metaData = metaSnap.data();
    const totalChunks = metaData.totalChunks || 1;
    console.log(`[Restore] Restaurando "${filename}" do Firestore (${totalChunks} partes)...`);

    const chunksColRef = collection(firestoreDb, "media_files", filename, "chunks");
    const chunksSnap = await getDocs(chunksColRef);
    
    const chunksMap: Record<number, string> = {};
    chunksSnap.forEach((d) => {
      const cData = d.data();
      chunksMap[cData.chunkIndex] = cData.data;
    });

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(targetPath);
    for (let i = 0; i < totalChunks; i++) {
      const b64 = chunksMap[i];
      if (!b64) {
        console.error(`[Restore Error] Parte ${i} ausente ao restaurar ${filename}`);
        writeStream.end();
        return false;
      }
      const chunkBuf = Buffer.from(b64, "base64");
      writeStream.write(chunkBuf);
    }
    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => resolve());
      writeStream.on("error", (err) => reject(err));
    });

    console.log(`[Restore] "${filename}" restaurado com sucesso no disco do container!`);
    return true;
  } catch (err) {
    console.error(`[Restore Error] Falha ao restaurar "${filename}" do Firestore:`, err);
    return false;
  }
}

// Stream file with full HTTP 206 Partial Content (Range) support for smooth video playback
function streamMediaFile(req: express.Request, res: express.Response, filePath: string, filename: string) {
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const mimeType = getMimeType(filename);
  const range = req.headers.range;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept-Ranges");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Accept-Ranges", "bytes");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize || start > end) {
      res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
      return res.end();
    }

    const chunksize = end - start + 1;
    const fileStream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": mimeType,
    });

    fileStream.pipe(res);
  } else {
    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
    });
    fs.createReadStream(filePath).pipe(res);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Make sure upload directory exists - we save uploads to /uploads at root
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Configure Multer storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `creator-portfolio-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage: storage,
    limits: {
      fileSize: 30 * 1024 * 1024, // Limit to 30MB
    },
  });

  app.use(express.json());

  // Dedicated media streaming & self-healing recovery route for /uploads/* and /api/media/*
  const handleMediaRequest = async (req: express.Request, res: express.Response) => {
    const rawFilename = req.params.filename || req.path.replace(/^\/(?:uploads|api\/media)\/?/, "");
    const filename = path.basename(rawFilename); // Prevent directory traversal
    if (!filename) {
      return res.status(404).json({ error: "Arquivo não especificado" });
    }

    const localFilePath = path.join(uploadDir, filename);

    // 1. Check if file already exists locally on disk
    if (fs.existsSync(localFilePath)) {
      return streamMediaFile(req, res, localFilePath, filename);
    }

    // 2. If not on local disk, try restoring from Firestore backup
    const restored = await restoreFileFromFirestore(filename, localFilePath);
    if (restored && fs.existsSync(localFilePath)) {
      return streamMediaFile(req, res, localFilePath, filename);
    }

    // 3. File truly does not exist - return clean 404 (DO NOT fall through to index.html)
    return res.status(404).json({ error: "Arquivo de mídia não encontrado ou expirado." });
  };

  app.get("/uploads/:filename", handleMediaRequest);
  app.get("/api/media/:filename", handleMediaRequest);

  const chunkUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit per chunk request
    },
  });

  // Chunked file upload endpoint with automatic server-side compression & cloud sync
  app.post("/api/upload-chunk", chunkUpload.single("chunk"), async (req, res) => {
    try {
      const { uploadId, chunkIndex, totalChunks, filename } = req.body;
      const file = req.file;

      if (!uploadId || chunkIndex === undefined || totalChunks === undefined || !file) {
        return res.status(400).json({ error: "Parâmetros do chunk inválidos." });
      }

      const index = parseInt(chunkIndex, 10);
      const total = parseInt(totalChunks, 10);

      const chunksDir = path.join(uploadDir, "chunks");
      if (!fs.existsSync(chunksDir)) {
        fs.mkdirSync(chunksDir, { recursive: true });
      }

      const sessionDir = path.join(chunksDir, uploadId);
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }

      // Write chunk file
      const chunkPath = path.join(sessionDir, `chunk-${index}`);
      fs.writeFileSync(chunkPath, file.buffer);

      // Check if we have received all chunks
      const filesInSession = fs.readdirSync(sessionDir);
      if (filesInSession.length === total) {
        // Merge chunks
        const finalExt = path.extname(filename).toLowerCase();
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const tempFilename = `creator-portfolio-temp-${uniqueSuffix}${finalExt}`;
        const tempFilePath = path.join(uploadDir, tempFilename);

        // Open write stream for the merged file
        const writeStream = fs.createWriteStream(tempFilePath);

        for (let i = 0; i < total; i++) {
          const currentChunkPath = path.join(sessionDir, `chunk-${i}`);
          if (!fs.existsSync(currentChunkPath)) {
            return res.status(400).json({ error: `Chunk ${i} está faltando para remontagem do arquivo.` });
          }
          const chunkBuffer = fs.readFileSync(currentChunkPath);
          writeStream.write(chunkBuffer);
        }
        writeStream.end();

        // Wait for write stream to finish merging
        await new Promise<void>((resolve, reject) => {
          writeStream.on("finish", () => resolve());
          writeStream.on("error", (err) => reject(err));
        });

        // Clean up session directory
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (rmErr) {
          console.error("Erro ao apagar pasta temporária de chunks:", rmErr);
        }

        // Check if it is a video file that we can compress and optimize
        const isVideo = [".mp4", ".mov", ".webm", ".mkv", ".avi", ".3gp", ".m4v", ".ogv"].includes(finalExt);
        const compressedFilename = `creator-portfolio-${uniqueSuffix}.mp4`;
        const compressedFilePath = path.join(uploadDir, compressedFilename);

        let finalSavedFilename = compressedFilename;
        let finalSavedPath = compressedFilePath;
        let wasCompressed = false;

        if (isVideo && ffmpegExec) {
          console.log(`Iniciando transcodificação e compressão do vídeo: ${tempFilename} -> ${compressedFilename}`);
          try {
            // Compress and transcode using ffmpeg with broad web compatibility flags
            const ffmpegProcess = spawn(ffmpegExec, [
              "-i", tempFilePath,
              "-vf", "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease", // scale down if larger than 720p
              "-c:v", "libx264",
              "-pix_fmt", "yuv420p", // Ensures playback on iOS, Safari, Chrome, Android
              "-profile:v", "main",
              "-level", "4.0",
              "-crf", "28", // Good web compression / small size
              "-preset", "veryfast",
              "-c:a", "aac",
              "-b:a", "128k",
              "-movflags", "+faststart", // Enables instant streaming before full download
              "-y",
              compressedFilePath
            ]);

            await new Promise<void>((resolvePromise, rejectPromise) => {
              ffmpegProcess.on("close", (code: number) => {
                if (code === 0) {
                  console.log("Transcodificação e compressão de vídeo concluída com sucesso!");
                  resolvePromise();
                } else {
                  console.error(`Falha na compressão do vídeo. Código de saída do ffmpeg: ${code}`);
                  rejectPromise(new Error(`Ffmpeg falhou com código ${code}`));
                }
              });
              ffmpegProcess.on("error", (err: any) => {
                console.error("Erro ao iniciar processo ffmpeg:", err);
                rejectPromise(err);
              });
            });

            // Delete original uncompressed temp file
            if (fs.existsSync(tempFilePath)) {
              fs.unlinkSync(tempFilePath);
            }
            wasCompressed = true;
          } catch (ffmpegErr) {
            console.error("Erro durante a compressão de vídeo, mantendo arquivo original:", ffmpegErr);
            finalSavedFilename = `creator-portfolio-${uniqueSuffix}${finalExt}`;
            finalSavedPath = path.join(uploadDir, finalSavedFilename);
            fs.renameSync(tempFilePath, finalSavedPath);
          }
        } else {
          finalSavedFilename = `creator-portfolio-${uniqueSuffix}${finalExt}`;
          finalSavedPath = path.join(uploadDir, finalSavedFilename);
          fs.renameSync(tempFilePath, finalSavedPath);
        }

        const stats = fs.statSync(finalSavedPath);

        // Backup asynchronously to Firestore so videos survive container restarts & scaling
        persistFileToFirestore(finalSavedPath, finalSavedFilename).catch(err => {
          console.error("Firestore backup error in background:", err);
        });

        return res.json({
          url: `/uploads/${finalSavedFilename}`,
          filename: finalSavedFilename,
          originalName: filename,
          size: stats.size,
          compressed: wasCompressed
        });
      }

      // Still uploading chunks
      return res.json({
        status: "chunk_uploaded",
        chunkIndex: index,
        totalChunks: total
      });

    } catch (err: any) {
      console.error("Erro no upload de chunk:", err);
      return res.status(500).json({ error: err.message || "Falha ao processar chunk" });
    }
  });

  // File upload API endpoint with custom multer error handling & persistent Firestore sync
  app.post("/api/upload", (req, res) => {
    upload.any()(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "O arquivo é muito grande. O limite máximo permitido por requisição em nuvem é de 30MB." });
        }
        return res.status(400).json({ error: `Erro no upload: ${err.message}` });
      }

      try {
        const files = (req as any).files;
        if (!files || !Array.isArray(files) || files.length === 0) {
          return res.status(400).json({ error: "Nenhum arquivo enviado" });
        }
        const file = files[0];
        const filePath = path.join(uploadDir, file.filename);
        
        // Backup to Firestore
        persistFileToFirestore(filePath, file.filename).catch(err => {
          console.error("Firestore backup for single upload error:", err);
        });

        const fileUrl = `/uploads/${file.filename}`;
        res.json({
          url: fileUrl,
          filename: file.filename,
          originalName: file.originalname,
          size: file.size,
        });
      } catch (err: any) {
        res.status(500).json({ error: err.message || "Falha ao salvar o upload" });
      }
    });
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV });
  });

  // Block Vite or SPA router from catching non-existent API or upload routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  app.all("/uploads/*", (req, res) => {
    res.status(404).json({ error: "Upload file not found" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

