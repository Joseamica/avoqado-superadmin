# Política de seguridad

## Reportar una vulnerabilidad

Si encontraste una vulnerabilidad en `avoqado-superadmin`:

1. **No abras un issue público en GitHub.**
2. Escribe a **security@avoqado.io** (o a `hola@avoqado.io` si security no responde en 24 h) con:
   - Descripción del problema.
   - Pasos para reproducirlo.
   - Impacto potencial.
   - Tu información de contacto (para crédito si aplica).
3. Espera acuse de recibo en menos de 48 h hábiles (zona México).

## Alcance

Cosas que sí queremos saber:

- Cualquier forma de bypass al rol `SUPERADMIN` (logueado pero no autorizado).
- XSS / inyección a través de campos renderizados.
- Filtración de cookies o datos sensibles vía URL / referrer / logs.
- CSP / SRI mal configurados.
- Dependencias con CVEs explotables.
- Cualquier ruta accesible sin auth que debería requerirlo.

Fuera de alcance (no urgentes):

- Bug visual / UX que no implique escalada de privilegios.
- Falta de rate-limiting en endpoints idempotentes.
- Issues que requieren acceso físico al equipo o credenciales ya comprometidas.

## Coordinated disclosure

No publicamos los detalles del exploit hasta que el fix esté desplegado en producción.
