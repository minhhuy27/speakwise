"use client";

import * as React from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playWordAudio, type SpeechAccent } from "@/lib/speech";
import { cn } from "@/lib/utils";

export interface AudioButtonProps {
  text: string;
  audioUrl?: string | null;
  accent?: SpeechAccent;
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "icon" | "sm";
}

export function AudioButton({
  text,
  audioUrl,
  accent = "en-US",
  className,
  variant = "outline",
  size = "icon",
}: AudioButtonProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!text.trim()) return;

    setIsPlaying(true);
    try {
      await playWordAudio(text, audioUrl, accent);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={!text.trim()}
      aria-label={`Listen to pronunciation of ${text}`}
      className={cn(
        "shrink-0 text-muted-foreground hover:text-foreground",
        size === "icon" && "h-9 w-9",
        isPlaying && "text-primary",
        className
      )}
    >
      <Volume2 className="h-4 w-4" />
    </Button>
  );
}
