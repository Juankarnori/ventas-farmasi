-- Datos de ejemplo para probar la app. Precios en USD, aproximados —
-- ajustalos a tu lista de precios real de Farmasi una vez que arranques.

insert into categories (name, color, sort_order) values
  ('Skincare', '#733865', 1),
  ('Maquillaje', '#A86FA3', 2),
  ('Perfumería', '#C8A6C3', 3),
  ('Cuidado Capilar', '#D6B6C5', 4),
  ('Cuidado Personal', '#3F3338', 5)
on conflict (name) do nothing;

insert into products (name, category_id, sale_price, cost_price, description, stock, low_stock_threshold, image_url)
select v.name, c.id, v.sale_price, v.cost_price, v.description, v.stock, v.low_stock_threshold, null
from (
  values
    ('Dr. C. Tuna Sérum Antimanchas Q10', 'Skincare', 18.50, 11.20, 'Sérum facial con Q10, ilumina y pareja el tono.', 12, 3),
    ('Agua Micelar Rose Water', 'Skincare', 9.80, 5.60, 'Desmaquillante suave con agua de rosas.', 20, 5),
    ('Base Sincero Full Coverage', 'Maquillaje', 15.20, 8.90, 'Base líquida cobertura alta, 12 tonos.', 15, 4),
    ('Máscara de Pestañas Diamond Lash', 'Maquillaje', 8.70, 4.60, 'Volumen y curvatura sin grumos.', 25, 6),
    ('Perfume Bright Times EDP 50ml', 'Perfumería', 24.50, 14.80, 'Floral frutal, ideal para el día.', 8, 2),
    ('Perfume Enigma Men EDT 100ml', 'Perfumería', 26.90, 16.20, 'Amaderado especiado.', 6, 2),
    ('Shampoo Argan Oil Reparador', 'Cuidado Capilar', 7.30, 3.90, 'Repara puntas abiertas, sin sulfatos.', 18, 5),
    ('Jabón Dr. C. Tuna Propóleo', 'Cuidado Personal', 4.20, 2.10, 'Jabón en barra antibacterial con propóleo.', 30, 8)
) as v(name, category_name, sale_price, cost_price, description, stock, low_stock_threshold)
join categories c on c.name = v.category_name
on conflict do nothing;
