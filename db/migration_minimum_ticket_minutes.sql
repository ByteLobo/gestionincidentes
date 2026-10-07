BEGIN;

UPDATE incidents
SET tiempo_minutos = 1,
    last_updated_at = now()
WHERE tiempo_minutos IS NOT NULL
  AND tiempo_minutos < 1;

ALTER TABLE incidents
  DROP CONSTRAINT IF EXISTS incidents_tiempo_minutos_min_check;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_tiempo_minutos_min_check
  CHECK (tiempo_minutos IS NULL OR tiempo_minutos >= 1);

COMMIT;
