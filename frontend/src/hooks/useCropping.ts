import { useState, useCallback } from 'react';
import { CropArea, CropAreaPixels } from '../types/upload';

/**
 * Custom hook for managing cropping state and operations
 * Provides cropping functionality with coordinate management
 */
export const useCropping = () => {
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 100, height: 100 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<CropAreaPixels>({ x: 0, y: 0, width: 0, height: 0 });
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  const onCropChange = useCallback((crop: CropArea) => {
    setCropArea(crop);
  }, []);

  const onCropComplete = useCallback((croppedArea: CropArea, croppedAreaPixels: CropAreaPixels) => {
    setCropArea(croppedArea);
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const applyCrop = useCallback(async (imageData: string): Promise<string> => {
    // Implementation will be added in task 5.2
    // This is a placeholder that will be replaced with actual cropping logic
    
    // For now, just return the original image
    const result = imageData;
    setCroppedImage(result);
    return result;
  }, []);

  const resetCrop = useCallback(() => {
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
    setCroppedAreaPixels({ x: 0, y: 0, width: 0, height: 0 });
    setCroppedImage(null);
  }, []);

  return {
    cropArea,
    croppedAreaPixels,
    croppedImage,
    onCropChange,
    onCropComplete,
    applyCrop,
    resetCrop
  };
};