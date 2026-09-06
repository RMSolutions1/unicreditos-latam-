# Unicréditos

Web de crédito online para personas. Lista para demo y despliegue: frontend, API y cuenta personal en un solo proyecto.

## Demo

| | |
|---|---|
| Correo | `ana@unicreditos.mx` |
| Contraseña | `demo1234` |

Ana ya tiene un crédito personal activo, pagos y documentos. También puedes crear una cuenta nueva desde **Solicitar crédito**.

La evaluación en demo es automática:

- Ingreso ≥ 2.6× la mensualidad → preaprobado
- Ingreso ≥ 1.6× → en revisión
- Menor → no aprobado

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre http://localhost:5173 (web) y http://localhost:3001/api/health (API).

## Despliegue

```bash
npm run build
npm start
```

La API y el sitio quedan en http://localhost:3001.

```bash
docker build -t unicreditos .
docker run -p 3001:3001 unicreditos
```

## Prueba rápida

Con el servidor encendido:

```bash
npm run smoke
```

## Rutas

`/`, `/creditos`, `/como-funciona`, `/simulador`, `/solicitar`, `/nosotros`, `/ayuda`, `/privacidad`, `/terminos`, `/cuenta`
