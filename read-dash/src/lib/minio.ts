// ===============================
// 🔥 MinIO Client Utility (Frontend)
// ===============================

export const MINIO_API = "https://uploads.irmlabs.my.id"; // bisa pakai domain Cloudflare Tunnel

// Secure API Key buat akses upload
export const API_KEY = import.meta.env.VITE_MINIO_API_KEY;

// -------------------------------------------------------------------------------------------------
export async function uploadToMinio(file: File, bucket: string): Promise<string> {
  if (!file) throw new Error("No file selected.");
  if (!API_KEY) throw new Error("Missing VITE_MINIO_API_KEY.");

  const form = new FormData();
  form.append("file", file);

  const res = await fetch(`${MINIO_API}/upload?bucket=${bucket}`, {
    method: "POST",
    headers: { "x-api-key": API_KEY },
    body: form,
  });

  if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);

  const data = await res.json();
  console.log("MinIO upload response:", data);

  // ===== RETURN FINAL PUBLIC URL =====
  const url = data.url || data.file_url || data.fileUrl || data.publicUrl || data.link;
  if (!url) {
    throw new Error(`Upload succeeded but no URL in response: ${JSON.stringify(data)}`);
  }
  return url;
}

// -------------------------------------------------------------------------------------------------
// 🗑 Delete file dari MinIO
// url contoh: DELETE https://uploads.irmlabs.my.id/delete?bucket=mybucket&file=nama.png
// -------------------------------------------------------------------------------------------------
export async function deleteFromMinio(url: string, bucket: string): Promise<boolean> {
  if (!isMinioUrl(url)) return false;

  const file = url.split("/").pop(); // extract filename
  if (!file) return false;

  const res = await fetch(`${MINIO_API}/delete?bucket=${bucket}&file=${file}`, {
    method: "DELETE",
    headers: { "x-api-key": API_KEY },
  });

  return res.ok;
}

// -------------------------------------------------------------------------------------------------
// 🔍 Cek apakah URL itu file dari MinIO
// -------------------------------------------------------------------------------------------------
export function isMinioUrl(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.includes("storage.irmlabs.my.id") ||
    url.includes("uploads.irmlabs.my.id") ||
    url.includes("minio.irmlabs.my.id")
  );
}

export default {
  uploadToMinio,
  deleteFromMinio,
  isMinioUrl,
};

