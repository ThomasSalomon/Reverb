"use client";

import React from "react";

interface AvatarProps {
  username: string;
  profileColor?: string | null;
  profileImage?: string | null;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const COLOR_MAP: Record<string, string> = {
  emerald: "#10b981",
  violet: "#8b5cf6",
  cobalt: "#3b82f6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  slate: "#64748b"
};

export default function Avatar({ username, profileColor, profileImage, size = 40, className, style }: AvatarProps) {
  const themeColor = profileColor && COLOR_MAP[profileColor] ? COLOR_MAP[profileColor] : "#10b981";

  // Check if profileImage is a valid non-empty URL or path
  if (profileImage && profileImage.trim() !== "") {
    return (
      <img
        src={profileImage}
        alt={`Avatar de @${username}`}
        className={className}
        loading="lazy"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          border: `2px solid ${themeColor}66`,
          backgroundColor: "#12131a",
          display: "block",
          ...style
        }}
      />
    );
  }

  // Fallback text avatar (initials)
  const initials = username.substring(0, 2).toUpperCase();

  return (
    <div
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "bold",
        fontSize: size > 40 ? "1.2rem" : "0.85rem",
        backgroundColor: `${themeColor}1a`,
        color: themeColor,
        border: `2px solid ${themeColor}33`,
        boxShadow: `0 0 10px ${themeColor}1a`,
        fontFamily: "var(--font-display), sans-serif",
        userSelect: "none",
        ...style
      }}
    >
      {initials}
    </div>
  );
}
