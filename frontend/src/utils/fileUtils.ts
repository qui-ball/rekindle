/**
 * Utility functions for file handling and conversion
 */

/**
 * Convert base64 string to File object
 * @param base64String - Base64 encoded image data
 * @param filename - Name for the file
 * @param mimeType - MIME type for the file (default: image/jpeg)
 * @returns File object
 */
export const base64ToFile = (
  base64String: string, 
  filename: string, 
  mimeType: string = 'image/jpeg'
): File => {
  // Remove data URL prefix if present
  const base64Data = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  
  // Convert base64 to binary
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  
  return new File([blob], filename, { type: mimeType });
};

/**
 * Get image dimensions from base64 string
 * @param base64String - Base64 encoded image data
 * @returns Promise with width and height
 */
export const getImageDimensionsFromBase64 = (base64String: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = base64String;
  });
};

/**
 * Map of file extensions to MIME types for fallback validation
 * Some browsers (especially Safari) may not report correct MIME types for HEIC files
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.heif': 'image/heic',
  '.webp': 'image/webp'
};

/**
 * Get file extension from filename
 * @param filename - The filename to extract extension from
 * @returns Lowercase extension with dot (e.g., '.jpg') or empty string
 */
const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.slice(lastDot).toLowerCase();
};

/**
 * Check if file type is valid by MIME type or extension fallback
 * @param file - File to check
 * @param allowedTypes - Array of allowed MIME types
 * @returns Whether the file type is valid
 */
const isValidFileType = (file: File, allowedTypes: string[]): boolean => {
  // First check by MIME type
  if (file.type && allowedTypes.includes(file.type)) {
    return true;
  }
  
  // Fallback to extension check (important for HEIC files on some browsers)
  const extension = getFileExtension(file.name);
  const mimeFromExtension = EXTENSION_TO_MIME[extension];
  
  if (mimeFromExtension && allowedTypes.includes(mimeFromExtension)) {
    return true;
  }
  
  return false;
};

/**
 * Validate file size and type
 * @param file - File object to validate
 * @param maxSize - Maximum file size in bytes
 * @param allowedTypes - Array of allowed MIME types
 * @returns Validation result
 */
export const validateFile = (
  file: File, 
  maxSize: number = 50 * 1024 * 1024, // 50MB default
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/heic', 'image/webp']
): { valid: boolean; error?: string } => {
  if (file.size > maxSize) {
    return { valid: false, error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB` };
  }
  
  if (!isValidFileType(file, allowedTypes)) {
    return { valid: false, error: `Unsupported file type. Allowed: ${allowedTypes.join(', ')}` };
  }
  
  return { valid: true };
};