-- BUG URGENTE: "Could not choose the best candidate function" al usar
-- "Pedir prestado" desde el flujo de venta (createLoanQuick).
--
-- Causa real: cada migración que le agregó un parámetro nuevo a
-- create_loan (valuation_type en 0027, custom_price en 0030) usó
-- `create or replace function create_loan(...)` con una lista de
-- parámetros DISTINTA a la anterior. Para Postgres, una función se
-- identifica por nombre + firma completa (tipos y cantidad de
-- parámetros) — `create or replace` solo reemplaza in-place cuando la
-- firma es IDÉNTICA a una ya existente; si cambia, crea una función
-- ADICIONAL en vez de reemplazar la vieja. Así terminaron coexistiendo
-- tres create_loan (5, 6 y 7 parámetros) en la base. Cuando el código
-- llama a la función sin fijar todos los parámetros nombrados (como hace
-- createLoanQuick, que no manda valuation_type ni custom_price porque
-- para ese flujo siempre son los default), Postgres no puede decidir cuál
-- de las tres funciones "menos específicas" usar y tira este error.
--
-- La solución es borrar explícitamente las firmas viejas, dejando una
-- sola función por nombre. update_loan tenía el mismo problema (0030 le
-- agregó custom_price sin borrar la firma de 5 parámetros de 0027) — no
-- llegó a manifestarse como error porque todo el código que la llama
-- siempre manda custom_price explícito (aunque sea null), pero igual
-- queda como basura/riesgo latente, así que se limpia acá también.
--
-- A futuro: cualquier migración que le agregue un parámetro a una
-- función ya existente tiene que hacer `drop function if exists
-- nombre(firma_vieja)` antes de crear la nueva — nunca confiar en que
-- `create or replace` sola alcanza cuando cambia la lista de parámetros.

-- create_loan: quedan coexistiendo la de 5 parámetros (p_variant_id,
-- p_quantity, p_from_profile_id, p_to_profile_id, p_note — de 0011/0014/
-- 0015) y la de 6 (+ p_valuation_type — de 0027). Se borran las dos,
-- queda solo la de 7 parámetros (+ p_custom_price) de 0030.
drop function if exists create_loan(uuid, int, uuid, uuid, text);
drop function if exists create_loan(uuid, int, uuid, uuid, text, text);

-- update_loan: quedaba coexistiendo la de 5 parámetros de 0027. Se borra,
-- queda solo la de 6 (+ p_custom_price) de 0030.
drop function if exists update_loan(uuid, uuid, int, text, text);
