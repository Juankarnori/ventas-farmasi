"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ImageOff, Loader2, UploadCloud } from "lucide-react";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { uploadProductImage, listProductImages } from "@/app/(app)/catalogo/actions";
import { VariantsEditor, type VariantDefault } from "./variants-editor";

export interface ProductFormValues {
  name: string;
  category_id: string | null;
  line_id: string | null;
  sale_price: number;
  cost_price: number;
  description: string | null;
  low_stock_threshold: number;
  image_url: string | null;
}

export interface ProductLineOption {
  id: string;
  name: string;
  category_id: string;
}

interface ExistingImage {
  name: string;
  url: string;
}

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

export function ProductForm({
  categories,
  lines,
  action,
  defaultValues,
  defaultVariants,
  submitLabel = "Guardar",
}: {
  categories: { id: string; name: string }[];
  lines: ProductLineOption[];
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: Partial<ProductFormValues>;
  defaultVariants?: VariantDefault[];
  submitLabel?: string;
}) {
  const [categoryId, setCategoryId] = useState(defaultValues?.category_id ?? "");
  const [lineId, setLineId] = useState(defaultValues?.line_id ?? "");
  const linesForCategory = lines.filter((l) => l.category_id === categoryId);

  function onCategoryChange(value: string) {
    setCategoryId(value);
    setLineId("");
  }

  const [imageMode, setImageMode] = useState<"existing" | "upload" | "url">("existing");
  const [imageUrl, setImageUrl] = useState(defaultValues?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listProductImages().then((imgs) => {
      setExistingImages(imgs);
      setLoadingImages(false);
    });
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Formato no soportado (usá png, jpg o webp)");
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError("La imagen pesa más de 5MB");
      return;
    }

    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadProductImage(fd);
    setUploading(false);

    if (result.error) {
      setUploadError(result.error);
      return;
    }
    if (result.url) {
      setImageUrl(result.url);
      setExistingImages((imgs) => [{ name: file.name, url: result.url! }, ...imgs]);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  const selectedExisting = existingImages.find((img) => img.url === imageUrl);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="image_url" value={imageUrl} />

      <div>
        <Label>Imagen</Label>
        <div className="mb-2 flex gap-4 text-xs text-ink/60">
          <button
            type="button"
            onClick={() => setImageMode("existing")}
            className={imageMode === "existing" ? "font-semibold text-primary" : ""}
          >
            Elegir existente
          </button>
          <button
            type="button"
            onClick={() => setImageMode("upload")}
            className={imageMode === "upload" ? "font-semibold text-primary" : ""}
          >
            Subir nueva
          </button>
          <button
            type="button"
            onClick={() => setImageMode("url")}
            className={imageMode === "url" ? "font-semibold text-primary" : ""}
          >
            Pegar URL
          </button>
        </div>

        {imageMode === "existing" && (
          <div ref={pickerRef} className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              aria-expanded={pickerOpen}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-ink/15 bg-white/80 px-3 py-2 text-left text-sm text-ink focus-visible:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
            >
              <span className="flex min-w-0 items-center gap-2">
                {selectedExisting ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedExisting.url}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded object-cover"
                    />
                    <span className="truncate">{selectedExisting.name}</span>
                  </>
                ) : (
                  <span className="truncate text-ink/40">
                    {loadingImages
                      ? "Cargando imágenes..."
                      : existingImages.length === 0
                        ? "Todavía no subiste ninguna imagen"
                        : "Seleccioná una imagen ya subida"}
                  </span>
                )}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-ink/40" aria-hidden />
            </button>

            {pickerOpen && existingImages.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gold/20 bg-surface shadow-lg">
                {existingImages.map((img) => (
                  <button
                    key={img.name}
                    type="button"
                    onClick={() => {
                      setImageUrl(img.url);
                      setPickerOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-panel/40"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                    <span className="truncate text-ink">{img.name}</span>
                    {img.url === imageUrl && (
                      <Check className="ml-auto h-4 w-4 shrink-0 text-primary" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {imageMode === "upload" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center",
              dragOver ? "border-primary bg-panel/30" : "border-ink/15",
            )}
          >
            <UploadCloud className="h-5 w-5 text-ink/40" aria-hidden />
            <p className="text-sm text-ink/60">
              Arrastrá una imagen acá o{" "}
              <label className="cursor-pointer font-medium text-primary hover:underline">
                elegí un archivo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </p>
            <p className="text-xs text-ink/40">JPG, PNG o WEBP · máx. 5MB</p>
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />}
          </div>
        )}

        {imageMode === "url" && (
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        )}

        {uploadError && (
          <p className="mt-2 rounded-md bg-accent/20 px-2 py-1 text-xs text-ink">{uploadError}</p>
        )}

        <div className="mt-3 flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-8 w-8 text-ink/20" aria-hidden />
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input id="name" name="name" required defaultValue={defaultValues?.name} />
      </div>

      <div>
        <Label htmlFor="category_id">Categoría</Label>
        <Select
          id="category_id"
          name="category_id"
          value={categoryId}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="line_id">Línea (opcional)</Label>
        <Select
          id="line_id"
          name="line_id"
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          disabled={!categoryId}
        >
          <option value="">Sin línea</option>
          {linesForCategory.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
        {!categoryId && <p className="mt-1 text-xs text-ink/40">Elegí una categoría primero</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="sale_price">Precio de venta</Label>
          <Input
            id="sale_price"
            name="sale_price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultValues?.sale_price}
          />
        </div>
        <div>
          <Label htmlFor="cost_price">Costo</Label>
          <Input
            id="cost_price"
            name="cost_price"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultValues?.cost_price}
          />
        </div>
      </div>

      <div className="w-40">
        <Label htmlFor="low_stock_threshold">Stock mínimo</Label>
        <Input
          id="low_stock_threshold"
          name="low_stock_threshold"
          type="number"
          min={0}
          required
          defaultValue={defaultValues?.low_stock_threshold ?? 3}
        />
      </div>

      <div>
        <Label htmlFor="description">Descripción / notas</Label>
        <Textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description ?? ""}
        />
      </div>

      <VariantsEditor defaultVariants={defaultVariants} />

      <Button type="submit" disabled={uploading}>
        {submitLabel}
      </Button>
    </form>
  );
}
