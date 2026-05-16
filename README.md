# CSMV2

CMS visual tipo Wix sin backend tradicional, orientado a publicar sitios en `github.io` usando GitHub Issues + GitHub Actions + archivos JSON.

## Capacidades implementadas

- Autenticacion local y roles: `admin`, `agente`, `usuario`.
- Registro directo para usuarios (`usuario`) sin espera de pipeline.
- Un solo proyecto por usuario.
- Editor drag-and-drop con bloques avanzados: `navbar`, `hero`, `text`, `features`, `gallery`, `faq`, `image`, `contactForm`, `cta`.
- Edicion inline de contenido, links e items.
- SEO por sitio: title, description, keywords, target de publicacion.
- Undo/Redo en el estudio.
- Versionado con snapshots restaurables.
- Guardado de plantillas por usuario y plantillas globales de admin.
- Plantilla global LabSpa original cargada con assets locales aislados en iframe para conservar el diseno real.
- Publicacion por entornos: `staging` y `production`.
- Captura de leads en formularios y bandeja de datos.
- Dashboard admin con graficas de roles, estado de proyectos y leads por sitio.
- Sitios publicos accesibles por URL (`#/s/<slug>`), sin login.
- Los sitios publicos leen `data/sites/<slug>.json` desplegado en GitHub Pages, no dependen solo de `localStorage`.
- Toda creacion dispara issue y termina en archivos JSON del repo (fuente final).

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
   - `data/agents/<email>.json`
   - `data/sites/<slug>.json` y `data/sites/<slug>.staging.json`
   - `data/templates/<template-id>.json`
   - `data/versions/<slug>.json`
   - `data/leads/<slug>.json`
   - `data/settings/platform.json`
   - `data/*/index.json` para descubrimiento rapido
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
