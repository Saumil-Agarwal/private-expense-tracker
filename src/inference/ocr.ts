"use client";

export async function extractReceiptText(file: File, onProgress?: (progress: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", 1, {
    logger(message) {
      if (message.status === "recognizing text") onProgress?.(message.progress);
    },
  });
  try {
    const result = await worker.recognize(file);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}
