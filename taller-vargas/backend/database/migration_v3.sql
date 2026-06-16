-- Migration V3: Add diagnostico to orderes_servicio and set default confirmado to false
ALTER TABLE ordenes_servicio ADD COLUMN IF NOT EXISTS diagnostico JSONB DEFAULT NULL;
ALTER TABLE solicitudes_mecanico ALTER COLUMN confirmado SET DEFAULT FALSE;
