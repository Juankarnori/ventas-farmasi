"use client";

import { useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { uploadProductImage } from "@/app/(app)/catalogo/actions";

export interface ProductFormValues {
  name: string;
  category_id: string | null;
  sale_price: number;
  cost_price: number;
  description: string | null;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
}

export function ProductForm({
  categories,
  action,
  defaultValues,
  submitLabel = "Guardar",
}: {
  categories: { id: string; name: string }[];
  action: (formData: FormData) => void | Promise<void>;
  defaultValues?: Partial<ProductFormValues>;
  submitLabel?: string;
}) {
  const [imageMode, setImageMode] = useState<"url" | "upload">("url");
  const [imageUrl, setImageUrl] = useState(defaultValues?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    const result = await uploadProductImage(fd);
    setUploading(false);
    if (result.error) setUploadError(result.error);
    else if (result.url) setImageUrl(result.url);
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="image_url" value={imageUrl} />

      <div>
        <Label>Imagen</Label>
        <div className="mb-2 flex gap-4 text-xs text-ink/60">
          <button
            type="button"
            onClick={() => setImageMode("url")}
            className={imageMode === "url" ? "font-semibold text-primary" : ""}
          >
            Pegar URL
          </button>
          <button
            type="button"
            onClick={() => setImageMode("upload")}
            className={imageMode === "upload" ? "font-semibold text-primary" : ""}
          >
            Subir archivo
          </button>
        </div>

        {imageMode === "url" ? (
          <Input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        ) : (
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="text-sm text-ink/70"
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>
        )}
        {uploadError && <p className="mt-1 text-xs text-accent">{uploadError}</p>}

        <div className="mt-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-ink/5">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="h-6 w-6 text-ink/20" />
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
          defaultValue={defaultValues?.category_id ?? ""}
        >
          <option value="">Sin categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="stock">Stock actual</Label>
          <Input
            id="stock"
            name="stock"
            type="number"
            min={0}
            required
            defaultValue={defaultValues?.stock ?? 0}
          />
        </div>
        <div>
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

      <Button type="submit" disabled={uploading}>
        {submitLabel}
      </Button>
    </form>
  );
}
