-- Ejecutar como root de MariaDB. Cambiar la contraseña antes de correr.
CREATE DATABASE IF NOT EXISTS mapgen CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mapgen'@'localhost' IDENTIFIED BY 'CAMBIAR_ESTA_CONTRASENA';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, REFERENCES, ALTER ON mapgen.* TO 'mapgen'@'localhost';
FLUSH PRIVILEGES;
