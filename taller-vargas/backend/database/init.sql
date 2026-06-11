-- TALLER AUTOMOTRIZ VARGAS - Esquema DB PostgreSQL 16
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  tipo_doc VARCHAR(5) NOT NULL CHECK (tipo_doc IN ('DNI','RUC','CE','PAS')),
  num_doc VARCHAR(20) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  telefono VARCHAR(30) NOT NULL,
  correo VARCHAR(255),
  direccion VARCHAR(500),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehiculos (
  id SERIAL PRIMARY KEY,
  placa VARCHAR(20) NOT NULL UNIQUE,
  marca_modelo VARCHAR(255) NOT NULL,
  anio INTEGER,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  ultima_visita DATE,
  vin VARCHAR(17),
  n_motor VARCHAR(50),
  tipo_motor VARCHAR(50),
  transmision VARCHAR(30),
  color VARCHAR(50),
  tipo_vehiculo VARCHAR(50) DEFAULT 'Sedan',
  km_actual INTEGER,
  km_ultimo_servicio INTEGER,
  km_ultimo_aceite INTEGER,
  km_ultimo_frenos INTEGER,
  km_ultimo_bujias INTEGER,
  km_ultimo_filtros INTEGER,
  km_ultimo_liquido_frenos INTEGER,
  km_ultimo_refrigerante INTEGER,
  km_ultimo_distribucion INTEGER,
  sug_aceite VARCHAR(255),
  sug_refrigerante VARCHAR(255),
  sug_bujias VARCHAR(255),
  sug_filtros VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS mecanicos (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ordenes_servicio (
  id SERIAL PRIMARY KEY,
  vehiculo_id INTEGER REFERENCES vehiculos(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  mecanico_id INTEGER REFERENCES mecanicos(id) ON DELETE SET NULL,
  estado VARCHAR(50) NOT NULL DEFAULT 'Diagnostico',
  kilometraje VARCHAR(50),
  nivel_combustible VARCHAR(10) DEFAULT '1/2',
  falla_reportada TEXT,
  repuestos_esperando TEXT,
  total_estimado DECIMAL(10,2) DEFAULT 0,
  fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega DATE,
  nota_interna TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items_costo (
  id SERIAL PRIMARY KEY,
  orden_id INTEGER NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
  tipo VARCHAR(20) DEFAULT 'manual',
  descripcion VARCHAR(500) NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  repuesto_cod VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS almacen (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(500) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  stock_min INTEGER NOT NULL DEFAULT 2,
  costo DECIMAL(10,2) NOT NULL DEFAULT 0,
  precio_venta DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS solicitudes_mecanico (
  id SERIAL PRIMARY KEY,
  mecanico_id INTEGER NOT NULL REFERENCES mecanicos(id) ON DELETE CASCADE,
  orden_id INTEGER REFERENCES ordenes_servicio(id) ON DELETE SET NULL,
  repuesto_id INTEGER NOT NULL REFERENCES almacen(id) ON DELETE CASCADE,
  cantidad INTEGER NOT NULL DEFAULT 1,
  fecha_entrega DATE,
  confirmado BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS cobros (
  id SERIAL PRIMARY KEY,
  orden_id INTEGER NOT NULL REFERENCES ordenes_servicio(id) ON DELETE CASCADE,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  monto_total DECIMAL(10,2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'Pendiente',
  metodo_pago VARCHAR(50),
  tipo_comprobante VARCHAR(50),
  es_dividido BOOLEAN DEFAULT FALSE,
  pagador2_nombre VARCHAR(255),
  pagador2_doc VARCHAR(50),
  monto_pagador1 DECIMAL(10,2),
  monto_pagador2 DECIMAL(10,2),
  comprobante2 VARCHAR(50),
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_cobro DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS archivos (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(500) NOT NULL,
  filename VARCHAR(500) NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  size_mb DECIMAL(10,2),
  area VARCHAR(100),
  subido_por VARCHAR(255) DEFAULT 'Admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO mecanicos (nombre) VALUES ('Carlos Mendoza'),('Ramiro Silva') ON CONFLICT DO NOTHING;

INSERT INTO clientes (tipo_doc,num_doc,nombre,telefono,correo,direccion) VALUES
  ('DNI','70123456','Juan Perez','987654321','juan.perez@email.com','Av. Las Flores 123'),
  ('RUC','20512345678','Transportes Garcia SAC','951847263','admin@tgarcia.pe','Z.I. Mz A Lote 4'),
  ('DNI','40231567','Pedro Alcazar','963258147','pedro.al@email.com','Calle Sol 44')
ON CONFLICT (num_doc) DO NOTHING;

INSERT INTO vehiculos (placa,marca_modelo,anio,cliente_id,ultima_visita) VALUES
  ('ABC-123','Toyota Hilux',2022,1,CURRENT_DATE),
  ('XYZ-789','Hyundai Santa Fe',2019,2,CURRENT_DATE),
  ('MNO-456','Nissan Frontier',2020,3,CURRENT_DATE)
ON CONFLICT (placa) DO NOTHING;

INSERT INTO almacen (codigo,descripcion,categoria,stock,stock_min,costo,precio_venta) VALUES
  ('REP-001','Aceite de Motor Sintetico 5W30 (Galon)','Lubricantes',12,5,120.00,185.00),
  ('REP-002','Pastillas de Freno Delanteras','Frenos',4,6,150.00,240.00),
  ('REP-003','Filtro de Aire K&N Alto Flujo','Filtros',15,4,45.00,85.00),
  ('REP-004','Bujia de Iridium Premium','Electrico',2,8,25.00,45.00),
  ('REP-005','Amortiguador de Suspension Delantero','Suspension',8,4,280.00,380.00),
  ('INS-001','Liquido de Frenos DOT 4','Insumos Taller',24,10,15.00,30.00)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO ordenes_servicio (vehiculo_id,cliente_id,mecanico_id,estado,kilometraje,nivel_combustible,falla_reportada,total_estimado,fecha_ingreso) VALUES
  (1,1,1,'En Proceso','45,000 Km','1/2','Mantenimiento preventivo completo.',150.00,CURRENT_DATE),
  (2,2,2,'Diagnostico','68,200 Km','1/4','Ruido metalico en suspension delantera.',0.00,CURRENT_DATE),
  (3,3,1,'Esperando Repuestos','89,100 Km','3/4','Perdida de potencia en pendientes.',0.00,CURRENT_DATE)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_clientes_updated_at') THEN
    CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_vehiculos_updated_at') THEN
    CREATE TRIGGER update_vehiculos_updated_at BEFORE UPDATE ON vehiculos FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_ordenes_updated_at') THEN
    CREATE TRIGGER update_ordenes_updated_at BEFORE UPDATE ON ordenes_servicio FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='update_almacen_updated_at') THEN
    CREATE TRIGGER update_almacen_updated_at BEFORE UPDATE ON almacen FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

CREATE OR REPLACE VIEW v_ordenes_completas AS
SELECT os.id, os.estado, os.kilometraje, os.nivel_combustible, os.falla_reportada,
  os.repuestos_esperando, os.total_estimado, os.fecha_ingreso, os.fecha_entrega,
  os.nota_interna, os.created_at,
  v.placa, v.marca_modelo AS vehiculo, v.anio,
  c.nombre AS cliente, c.telefono, c.num_doc, c.tipo_doc,
  m.nombre AS mecanico
FROM ordenes_servicio os
LEFT JOIN vehiculos v ON os.vehiculo_id = v.id
LEFT JOIN clientes c ON os.cliente_id = c.id
LEFT JOIN mecanicos m ON os.mecanico_id = m.id;

CREATE OR REPLACE VIEW v_items_por_orden AS
SELECT ic.*, (ic.cantidad * ic.precio_unitario) AS subtotal FROM items_costo ic;

CREATE OR REPLACE VIEW v_alertas_stock AS
SELECT id, codigo, descripcion, categoria, stock, stock_min, (stock_min - stock) AS deficit
FROM almacen WHERE stock <= stock_min ORDER BY deficit DESC;
