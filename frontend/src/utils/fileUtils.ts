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
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: `Unsupported file type. Allowed: ${allowedTypes.join(', ')}` };
  }
  
  return { valid: true };
};