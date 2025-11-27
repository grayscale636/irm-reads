// MinIO Configuration - menggunakan FastAPI backend sebagai proxy
const API_ENDPOINT = "http://192.168.100.220:8113";

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

// Compress image sebelum upload
async function compressImage(file: File, maxWidth: number, maxHeight: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    
    img.onload = () => {
      let { width, height } = img;
      
      // Calculate new dimensions
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to compress image'));
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

// Generate unique filename - selalu pakai .jpg karena sudah di-compress ke JPEG
function generateFileName(originalName: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `cover-${timestamp}-${random}.jpg`;
}

// Upload image via FastAPI backend
export async function uploadToMinio(file: File): Promise<UploadResult> {
  try {
    // Compress image first (max 400x600, 80% quality)
    const compressedBlob = await compressImage(file, 400, 600, 0.8);
    const fileName = generateFileName(file.name);
    
    // Create FormData untuk upload
    const formData = new FormData();
    formData.append('file', compressedBlob, fileName);

    const response = await fetch(`${API_ENDPOINT}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        url: data.file_url
      };
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Upload failed:', errorData);
      return {
        success: false,
        error: errorData.error || `Upload failed: ${response.status}`
      };
    }
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
}

// Delete image - perlu endpoint delete di FastAPI backend
export async function deleteFromMinio(imageUrl: string): Promise<boolean> {
  // TODO: Implement delete endpoint di FastAPI backend jika diperlukan
  console.log('Delete not implemented yet for:', imageUrl);
  return true;
}

// Check if URL is from MinIO
export function isMinioUrl(url: string): boolean {
  return url.includes('192.168.100.220:8111') || url.includes('mybucket') || url.includes('X-Amz-');
}
