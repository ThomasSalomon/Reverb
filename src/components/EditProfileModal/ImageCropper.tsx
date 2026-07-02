"use client";

import React, { useState, useRef, useEffect } from "react";
import styles from "../SharedModal.module.css";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedImageBase64: string) => void;
  onCancel: () => void;
  profileColor: string;
}

const CROP_SIZE = 240; // Diameter of crop circle

const COLOR_MAP: Record<string, string> = {
  emerald: "#10b981",
  violet: "#8b5cf6",
  cobalt: "#3b82f6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b"
};

export default function ImageCropper({ imageSrc, onCropComplete, onCancel, profileColor }: ImageCropperProps) {
  const activeColor = COLOR_MAP[profileColor] || "#10b981";
  
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState<{
    naturalWidth: number;
    naturalHeight: number;
    baseScale: number;
  } | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const offsetStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Initialize dimensions when image loads
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nW = img.naturalWidth;
    const nH = img.naturalHeight;
    
    // baseScale is the minimum scale required for the image to completely cover the crop circle
    const baseScale = Math.max(CROP_SIZE / nW, CROP_SIZE / nH);
    
    setImgDimensions({
      naturalWidth: nW,
      naturalHeight: nH,
      baseScale
    });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Calculate maximum allowed drag offsets
  const getMaxDragOffsets = (currentZoom: number) => {
    if (!imgDimensions) return { maxX: 0, maxY: 0 };
    
    const W_d = imgDimensions.naturalWidth * imgDimensions.baseScale;
    const H_d = imgDimensions.naturalHeight * imgDimensions.baseScale;
    const W_r = W_d * currentZoom;
    const H_r = H_d * currentZoom;
    
    const maxX = Math.max(0, (W_r - CROP_SIZE) / 2);
    const maxY = Math.max(0, (H_r - CROP_SIZE) / 2);
    
    return { maxX, maxY };
  };

  const handleZoomChange = (newZoom: number) => {
    const clampedZoom = Math.max(1, Math.min(3, newZoom));
    setZoom(clampedZoom);
    
    // Clamp offset to new zoom bounds immediately
    const { maxX, maxY } = getMaxDragOffsets(clampedZoom);
    setOffset(prev => ({
      x: Math.max(-maxX, Math.min(maxX, prev.x)),
      y: Math.max(-maxY, Math.min(maxY, prev.y))
    }));
  };

  // Drag start
  const handleStart = (clientX: number, clientY: number) => {
    if (!imgDimensions) return;
    dragStartRef.current = { x: clientX, y: clientY };
    offsetStartRef.current = { ...offset };
    setIsDragging(true);
  };

  // Drag move
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current || !imgDimensions) return;
    
    const dx = clientX - dragStartRef.current.x;
    const dy = clientY - dragStartRef.current.y;
    
    const targetX = offsetStartRef.current.x + dx;
    const targetY = offsetStartRef.current.y + dy;
    
    const { maxX, maxY } = getMaxDragOffsets(zoom);
    
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, targetX)),
      y: Math.max(-maxY, Math.min(maxY, targetY))
    });
  };

  // Drag end
  const handleEnd = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    handleMove(e.clientX, e.clientY);
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  // Clean up mouse events on window if dragged out
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (isDragging) handleEnd();
    };
    
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  }, [isDragging]);

  // Crop & Apply
  const handleCrop = () => {
    if (!imgDimensions || !imgRef.current) return;
    
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, 400, 400);
    
    const W_d = imgDimensions.naturalWidth * imgDimensions.baseScale;
    const H_d = imgDimensions.naturalHeight * imgDimensions.baseScale;
    const W_r = W_d * zoom;
    const H_r = H_d * zoom;
    
    // Scale factor from UI to Canvas
    const F = 400 / CROP_SIZE;
    
    const W_canvas = W_r * F;
    const H_canvas = H_r * F;
    
    ctx.save();
    // Translate canvas origin to center and apply offsets in canvas coordinates
    ctx.translate(200 + offset.x * F, 200 + offset.y * F);
    // Draw image centered at current origin
    ctx.drawImage(
      imgRef.current,
      -W_canvas / 2,
      -H_canvas / 2,
      W_canvas,
      H_canvas
    );
    ctx.restore();
    
    try {
      const croppedBase64 = canvas.toDataURL("image/jpeg", 0.85);
      onCropComplete(croppedBase64);
    } catch (err) {
      console.error("Failed to crop image:", err);
    }
  };

  return (
    <div className={styles.cropperContainer}>
      <p className={styles.cropperSubtitle}>Arrastra y haz zoom para encuadrar tu foto de perfil</p>
      
      {/* Cropper Viewport wrapper */}
      <div 
        ref={containerRef}
        className={styles.cropperViewportWrapper}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handleEnd}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Original a recortar"
          onLoad={handleImageLoad}
          className={styles.cropperImage}
          style={{
            transform: `translate3d(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px), 0) scale(${zoom * (imgDimensions?.baseScale || 1)})`,
            // Set position absolute, and left/top 50% so translation behaves centered
            position: "absolute",
            left: "50%",
            top: "50%",
            transformOrigin: "center center",
            maxWidth: "none",
            maxHeight: "none",
            userSelect: "none",
            pointerEvents: "none" // Disable native browser image drag
          }}
        />
        
        {/* Overlay Crop Mask */}
        <div 
          className={styles.cropperMaskCircle}
          style={{
            borderColor: activeColor,
            boxShadow: `0 0 0 9999px rgba(9, 9, 11, 0.75), 0 0 15px ${activeColor}33`
          }}
        />
      </div>

      {/* Zoom controls */}
      <div className={styles.cropperControls}>
        <button
          type="button"
          onClick={() => handleZoomChange(zoom - 0.1)}
          className={styles.zoomBtn}
          title="Reducir zoom"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        
        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
          className={styles.zoomSlider}
          style={{ "--slider-color": activeColor } as React.CSSProperties}
        />
        
        <button
          type="button"
          onClick={() => handleZoomChange(zoom + 0.1)}
          className={styles.zoomBtn}
          title="Aumentar zoom"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Action Footer */}
      <div className={styles.cropperFooter}>
        <button 
          type="button" 
          onClick={onCancel} 
          className={styles.cropperCancelBtn}
        >
          Cancelar
        </button>
        <button 
          type="button" 
          onClick={handleCrop} 
          className={styles.cropperSaveBtn}
          style={{
            backgroundColor: activeColor,
            boxShadow: `0 4px 12px ${activeColor}40`
          }}
        >
          Recortar y Aplicar
        </button>
      </div>
    </div>
  );
}
