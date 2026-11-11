// Datos del concesionario que usan las captaciones y los contratos (salen de src/negocio.js).
import { NEGOCIO, SITIO } from '../negocio.js';

export const MARCA = {
  nombre: NEGOCIO.nombre,
  sitio: SITIO,
  remitente: NEGOCIO.remitente,
  correo: NEGOCIO.email,
  localidad: NEGOCIO.localidad,
  domicilio: NEGOCIO.domicilio || NEGOCIO.direccion,
  titular: NEGOCIO.titular,
  logo: NEGOCIO.logo,
  // huecos del contrato de serie (src/lib/contrato.js) que cambian de una web a otra; se cambian en Ajustes → Contratos
  garantia_meses: 6,
};
