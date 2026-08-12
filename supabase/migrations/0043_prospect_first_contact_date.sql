-- Fecha de primer contacto con el prospecto — opcional, para saber
-- cuándo arrancó la conversación (venta o posible ingreso al equipo).
-- También la usa la nueva regla de seguimiento 'despues_de_contacto'
-- (ver 0044) como fecha base para contar los días.
alter table prospects add column first_contact_date date;
