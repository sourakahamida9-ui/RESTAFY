import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Loader2, ImageIcon, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import SafeImage from '@/components/SafeImage';

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  bucket?: string;
  folder?: string;
  label?: string;
  aspectRatio?: 'square' | 'banner';
  className?: string;
}

export function ImageUpload({
  value,
  onChange,
  bucket = 'restaurants',
  folder = 'images',
  label = 'Cliquer pour uploader',
  aspectRatio = 'square',
  className,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bucketReady, setBucketReady] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Vérifier que le bucket existe et est public
  useEffect(() => {
    const checkBucket = async () => {
      try {
        const { data, error: listError } = await supabase.storage.from(bucket).list('', { limit: 1 });
        if (listError?.message.includes('Bucket not found')) {
          setError(`Bucket '${bucket}' n'existe pas. Contactez l'admin.`);
          setBucketReady(false);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.log(`[v0] Bucket '${bucket}' accessible`);
      }
    };
    checkBucket();
  }, [bucket]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (!file.type.startsWith('image/')) {
      setError('Fichier invalide. Seules les images sont acceptées.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image trop lourde. Maximum 5MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const ext = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
      onChange(data.publicUrl);
      setError(null);
    } catch (err) {
      setError('Échec de l\'upload. Réessayez.');
      if (import.meta.env.DEV) console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const aspectRatioClass = {
    square: 'aspect-square',
    banner: 'aspect-video',
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        onClick={() => bucketReady && inputRef.current?.click()}
        className={cn(
          'relative border-2 border-dashed border-zinc-700 rounded-xl p-8 transition cursor-pointer hover:border-primary/50 hover:bg-primary/5',
          (uploading || !bucketReady) && 'opacity-50 cursor-not-allowed',
          value && 'border-solid border-zinc-600'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          disabled={uploading || !bucketReady}
          className="hidden"
        />

        {value ? (
          <div className={cn('relative w-full rounded-lg overflow-hidden', aspectRatioClass[aspectRatio])}>
            <SafeImage
              src={value}
              alt="Preview"
              className="w-full h-full object-cover"
              fallbackType="placeholder"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-lg transition"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8 text-zinc-500" />
                <div className="text-center">
                  <p className="font-semibold text-sm text-zinc-200">{label}</p>
                  <p className="text-xs text-zinc-500 mt-1">PNG, JPG ou GIF (max 5MB)</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
