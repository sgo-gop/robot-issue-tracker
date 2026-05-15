CREATE TYPE public.robot_type AS ENUM ('LARA 3','LARA 5','LARA 8','LARA 10','MAIRA M','MAIRA S','MAIRA L');

ALTER TABLE public.issues ADD COLUMN robot_type public.robot_type;

ALTER TABLE public.issues DROP COLUMN station_id;

DROP TABLE public.stations;