-- Datos de ejemplo para probar la app. Precios en ARS, aproximados —
-- ajustalos a tu lista de precios real de Farmasi una vez que arranques.

insert into categories (name, color, sort_order) values
  ('Skincare', '#0F6E68', 1),
  ('Maquillaje', '#F2637B', 2),
  ('Perfumería', '#C9A15A', 3),
  ('Cuidado Capilar', '#8FA998', 4),
  ('Cuidado Personal', '#2B2320', 5)
on conflict (name) do nothing;

insert into products (name, category_id, sale_price, cost_price, description, stock, low_stock_threshold, image_url)
select v.name, c.id, v.sale_price, v.cost_price, v.description, v.stock, v.low_stock_threshold, null
from (
  values
    ('Dr. C. Tuna Sérum Antimanchas Q10', 'Skincare', 18500, 11200, 'Sérum facial con Q10, ilumina y pareja el tono.', 12, 3),
    ('Agua Micelar Rose Water', 'Skincare', 9800, 5600, 'Desmaquillante suave con agua de rosas.', 20, 5),
    ('Base Sincero Full Coverage', 'Maquillaje', 15200, 8900, 'Base líquida cobertura alta, 12 tonos.', 15, 4),
    ('Máscara de Pestañas Diamond Lash', 'Maquillaje', 8700, 4600, 'Volumen y curvatura sin grumos.', 25, 6),
    ('Perfume Bright Times EDP 50ml', 'Perfumería', 24500, 14800, 'Floral frutal, ideal para el día.', 8, 2),
    ('Perfume Enigma Men EDT 100ml', 'Perfumería', 26900, 16200, 'Amaderado especiado.', 6, 2),
    ('Shampoo Argan Oil Reparador', 'Cuidado Capilar', 7300, 3900, 'Repara puntas abiertas, sin sulfatos.', 18, 5),
    ('Jabón Dr. C. Tuna Propóleo', 'Cuidado Personal', 4200, 2100, 'Jabón en barra antibacterial con propóleo.', 30, 8)
) as v(name, category_name, sale_price, cost_price, description, stock, low_stock_threshold)
join categories c on c.name = v.category_name
on conflict do nothing;
