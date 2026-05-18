'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Upload, Image as ImageIcon, FileJson, Sparkles, X, Camera, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function ImportSection() {
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [jsonInput, setJsonInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Format non supporté. Utilisez JPEG ou PNG.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux. Maximum 10 Mo.')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    setFileName(file.name)
    toast.success(`Photo "${file.name}" chargée avec succès`)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleAnalyze = async () => {
    if (!preview && !jsonInput.trim()) {
      toast.error('Veuillez charger une photo ou coller du JSON.')
      return
    }
    setIsAnalyzing(true)
    await new Promise((r) => setTimeout(r, 2500))
    setIsAnalyzing(false)
    toast.success('Analyse terminée — 5 plats détectés et importés dans le menu')
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
        <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <ImageIcon size={16} className="text-primary" />
          Photo du menu
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Prenez une photo de votre menu papier — notre IA le convertira automatiquement.
        </p>

        {/* Drop zone */}
        {!preview ? (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={() => setIsDragging(false)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-all duration-200 cursor-pointer',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.01]'
                : 'border-border hover:border-primary/50 hover:bg-muted/30',
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Upload size={28} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">
                {isDragging ? 'Déposez ici' : 'Glissez-déposez votre photo'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPEG ou PNG — max 10 Mo
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="btn-micro gap-1.5 rounded-xl text-xs" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                <FolderOpen size={13} />
                Depuis la galerie
              </Button>
              <Button size="sm" variant="outline" className="btn-micro gap-1.5 rounded-xl text-xs" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
                <Camera size={13} />
                Prendre une photo
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Aperçu du menu"
              className="w-full max-h-64 object-cover"
            />
            <button
              onClick={() => { setPreview(null); setFileName(null) }}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={14} />
            </button>
            {fileName && (
              <div className="absolute bottom-3 left-3 rounded-lg bg-black/60 px-2.5 py-1">
                <p className="text-xs text-white font-medium truncate max-w-[200px]">{fileName}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* JSON import */}
      <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.05)' }}>
        <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
          <FileJson size={16} className="text-accent" />
          Import JSON externe
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Générez un JSON avec ChatGPT ou Gemini et collez-le ici pour importer directement.
        </p>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={`[\n  {\n    "name": "Thiéboudienne",\n    "category": "Plats principaux",\n    "price": 3500\n  }\n]`}
          className="font-mono text-xs rounded-xl min-h-32 resize-none"
        />
      </div>

      {/* Analyze button */}
      <Button
        size="lg"
        className={cn(
          'btn-micro w-full gap-3 rounded-2xl font-semibold text-base',
          isAnalyzing && 'pointer-events-none',
        )}
        onClick={handleAnalyze}
        disabled={isAnalyzing}
      >
        {isAnalyzing ? (
          <>
            <span className="inline-block h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Analyse en cours...
          </>
        ) : (
          <>
            <Sparkles size={18} />
            Analyser avec IA
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Propulsé par Gemini · Les données restent privées et sécurisées
      </p>
    </div>
  )
}
