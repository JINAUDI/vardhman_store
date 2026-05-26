"use client";

import React, { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImagePlus, X, Film, Upload } from "lucide-react";
import type { ProductDraft } from "@/lib/store/types";

interface MediaUploadProps {
  draft: ProductDraft;
  onUpdate: (updates: Partial<ProductDraft>) => void;
}

const MediaUpload: React.FC<MediaUploadProps> = ({ draft, onUpdate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      handleFiles(files);
    },
    [draft.images]
  );

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        onUpdate({
          images: [...draft.images, result],
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const removeImage = (index: number) => {
    onUpdate({
      images: draft.images.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">Photos</CardTitle>
          <p className="text-sm text-default-500 mt-1">
            Add up to 10 photos. Use clear, well-lit images.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200",
              "border-default-300 hover:border-primary hover:bg-primary/5",
              "group"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-default-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                <Upload className="h-5 w-5 text-default-400 group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium text-default-700">
                  Drag & drop images here
                </p>
                <p className="text-xs text-default-400 mt-1">
                  or click to browse • PNG, JPG up to 5MB
                </p>
              </div>
            </div>
          </div>

          {/* Image Previews */}
          {draft.images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {draft.images.map((img, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-lg overflow-hidden border border-default-200"
                >
                  <img
                    src={img}
                    alt={`Product ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {index === 0 && (
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded">
                      COVER
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="absolute top-1 right-1 h-5 w-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {/* Add More Button */}
              {draft.images.length < 10 && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-lg border-2 border-dashed border-default-300 flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <ImagePlus className="h-5 w-5 text-default-400" />
                  <span className="text-[10px] text-default-400">Add</span>
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video */}
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-default-500" />
            <CardTitle className="text-lg">Video (Optional)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label className="w-[120px] shrink-0 text-sm">Video URL</Label>
            <Input
              value={draft.videoUrl || ""}
              onChange={(e) => onUpdate({ videoUrl: e.target.value })}
              placeholder="https://youtube.com/watch?v=..."
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MediaUpload;
