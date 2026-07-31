-- Bucket publico para fotos de producto. Si preferis crearlo a mano,
-- Dashboard de Supabase -> Storage -> New bucket, nombre "product-images",
-- marcado como publico, y podes saltarte este archivo.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "product-images public read"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "product-images authenticated insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images');

create policy "product-images authenticated update"
on storage.objects for update to authenticated
using (bucket_id = 'product-images');

create policy "product-images authenticated delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images');
