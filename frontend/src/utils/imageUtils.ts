/**
 * Image processing utility functions
 * Provides common image operations and transformations
 */

/**
 * Get image dimensions from file
 */
export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.width, height: img.height });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
};

/**
 * Resize image to fit within max dimensions while maintaining aspect ratio
 */
export const resizeImage = (
  imageData: string, 
  maxWidth: number, 
  maxHeight: number, 
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    
    img.src = imageData;
  });
};

/**
 * Create thumbnail from image data
 */
export const createThumbnail = (imageData: string, size: number = 150): Promise<string> => {
  return resizeImage(imageData, size, size, 0.7);
};

/**
 * Detect if image is likely a photo of a photo (for physical photo detection)
 */
export const detectPhotoOfPhoto = (_imageData: string): Promise<boolean> => {
  // Implementation will be added in task 4.2 with edge detection
  return Promise.resolve(false);
};

/**
 * Calculate optimal crop area for a photo
 */
export const calculateOptimalCrop = (
  imageWidth: number, 
  imageHeight: number, 
  targetAspectRatio?: number
): { x: number; y: number; width: number; height: number } => {
  if (!targetAspectRatio) {
    // Return full image if no aspect ratio specified
    return { x: 0, y: 0, width: imageWidth, height: imageHeight };
  }
  
  const imageAspectRatio = imageWidth / imageHeight;
  
  if (imageAspectRatio > targetAspectRatio) {
    // Image is wider than target - crop width
    const newWidth = imageHeight * targetAspectRatio;
    return {
      x: (imageWidth - newWidth) / 2,
      y: 0,
      width: newWidth,
      height: imageHeight
    };
  } else {
    // Image is taller than target - crop height
    const newHeight = imageWidth / targetAspectRatio;
    return {
      x: 0,
      y: (imageHeight - newHeight) / 2,
      width: imageWidth,
      height: newHeight
    };
  }
};