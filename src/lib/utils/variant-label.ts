// Las variantes de un solo color se llaman "Único" (ver migración
// 0014_product_variants.sql). Para esas no tiene sentido mostrar el color
// en pantalla — se ve igual que un producto sin variantes.
export function variantLabel(productName: string, colorName: string) {
  return colorName === "Único" ? productName : `${productName} — ${colorName}`;
}
