# CSMV2

CMS visual tipo Wix sin backend tradicional, orientado a publicar sitios en `github.io` usando GitHub Issues + GitHub Actions + archivos JSON.

## Capacidades implementadas

- Autenticacion local y roles: `admin`, `agente`, `usuario`.
- Registro directo para usuarios (`usuario`) sin espera de pipeline.
- Un solo proyecto por usuario.
- Editor drag-and-drop de bloques (hero, texto, imagen, features, CTA).
- Guardado de plantillas por usuario y plantillas globales de admin.
- Publicacion mediante issue automatizado (`publish-site`).
- Cola de comandos en `data/queue/` y materializacion a JSON por workflow.
- Dashboard admin con graficas de roles y estado de proyectos.
- Sitios publicos accesibles por URL (`#/s/<slug>`), sin login.

## EPE2 (lenguaje operativo)

Toda la automatizacion de payloads sensibles usa **EPE2-only**.

- Formato obligatorio: `EPE2:<base64(json)>`.
- Integridad incluida en payload para detectar manipulacion.
- Sin compatibilidad hacia `EPE1` ni formato legacy.
- El nombre de archivo logico (`<command>.json`) funciona como llave operativa para cifrado/descifrado.

## Flujos GitHub

1. El frontend abre un issue con etiqueta `csm-command` y payload EPE2.
2. `process-issues.yml` extrae el comando y guarda en `data/queue/issue-<n>.json`.
3. `apply-queue.yml` procesa la cola y materializa archivos JSON:
   - `data/users/<email>.json`
   - `data/sites/<slug>.json`
   - `data/templates/<template-id>.json`
4. `deploy-pages.yml` publica la app en GitHub Pages.

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
