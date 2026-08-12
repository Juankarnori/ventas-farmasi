-- Reglas de seguimiento aplicables también a Prospectos, no solo a
-- Clientes: nuevo trigger_type 'despues_de_contacto', que cuenta los
-- días desde `prospects.first_contact_date` en vez de la fecha de una
-- venta.
--
-- follow_up_tasks.customer_id pasa a ser opcional y se agrega
-- prospect_id (también opcional) — una tarea es de UNA sola clienta O UN
-- solo prospecto, nunca los dos ni ninguno (constraint de abajo). Así
-- "Hoy toca contactar" sigue siendo una única lista para las dos cosas,
-- en vez de dos listas separadas que alguien tendría que revisar por
-- separado.

alter table follow_up_tasks alter column customer_id drop not null;
alter table follow_up_tasks add column prospect_id uuid references prospects (id) on delete cascade;

alter table follow_up_tasks add constraint follow_up_tasks_customer_xor_prospect_check
  check (
    (customer_id is not null and prospect_id is null)
    or (customer_id is null and prospect_id is not null)
  );

create index follow_up_tasks_prospect_idx on follow_up_tasks (prospect_id);

alter table follow_up_rules drop constraint follow_up_rules_trigger_type_check;
alter table follow_up_rules add constraint follow_up_rules_trigger_type_check
  check (trigger_type in ('despues_de_venta', 'cumpleanos', 'despues_de_contacto'));

-- days_after ahora es obligatorio también para 'despues_de_contacto'
-- (mismo motivo que 'despues_de_venta': hace falta contar desde una
-- fecha base) — solo 'cumpleanos' sigue sin necesitarlo.
alter table follow_up_rules drop constraint follow_up_rules_days_after_check;
alter table follow_up_rules add constraint follow_up_rules_days_after_check check (
  (trigger_type in ('despues_de_venta', 'despues_de_contacto') and days_after is not null and days_after > 0)
  or (trigger_type = 'cumpleanos' and days_after is null)
);

-- Genera, para un prospecto con first_contact_date ya cargada, una
-- follow_up_task por cada regla activa 'despues_de_contacto' — llamada
-- desde createProspect/updateProspect cuando first_contact_date viene
-- seteada. Mismo patrón que create_follow_up_tasks_for_sale, pero:
--   * cuenta desde first_contact_date, no desde una venta,
--   * apunta a prospect_id, no a customer_id,
--   * el guard "not exists" evita duplicar si se llama más de una vez
--     para el mismo prospecto (ej. se edita el first_contact_date dos
--     veces) — a diferencia de una venta, un prospecto se puede editar
--     libremente después de creado.
create or replace function create_follow_up_tasks_for_prospect(
  p_prospect_id uuid,
  p_first_contact_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prospect_name text;
  r record;
  v_message text;
begin
  if p_first_contact_date is null then
    return;
  end if;

  select name into v_prospect_name from prospects where id = p_prospect_id;
  if v_prospect_name is null then
    return;
  end if;

  for r in
    select id, message_template, days_after
    from follow_up_rules
    where trigger_type = 'despues_de_contacto' and active = true
  loop
    if not exists (
      select 1 from follow_up_tasks where prospect_id = p_prospect_id and rule_id = r.id
    ) then
      v_message := replace(r.message_template, '{nombre}', v_prospect_name);

      insert into follow_up_tasks (prospect_id, rule_id, due_date, message_preview)
      values (p_prospect_id, r.id, p_first_contact_date + r.days_after, v_message);
    end if;
  end loop;
end;
$$;

grant execute on function create_follow_up_tasks_for_prospect(uuid, date) to authenticated;

notify pgrst, 'reload schema';
