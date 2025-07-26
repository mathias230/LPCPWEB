# 🎥 Configuración de Cloudinary para LPCP

## ¿Qué cambió?

Tu sitio web ahora usa **Cloudinary** para almacenar los videos de forma permanente. Esto significa que:
- ✅ Los videos NO se borrarán cuando el servidor de Render se apague
- ✅ Los videos se cargan más rápido (CDN global)
- ✅ Optimización automática de videos
- ✅ La funcionalidad de clips sigue siendo exactamente la misma

## Configuración (Solo 3 pasos)

### 1. Crear cuenta en Cloudinary (GRATIS)
- Ve a: https://cloudinary.com/users/register/free
- Crea tu cuenta gratuita
- Confirma tu email

### 2. Obtener credenciales
- Ve a tu Dashboard: https://cloudinary.com/console
- Copia estos 3 valores:
  - **Cloud Name**
  - **API Key** 
  - **API Secret**

### 3. Configurar variables de entorno

**En tu computadora local:**
Crea un archivo `.env` en la carpeta del proyecto con:
```
CLOUDINARY_CLOUD_NAME=tu_cloud_name_aqui
CLOUDINARY_API_KEY=tu_api_key_aqui
CLOUDINARY_API_SECRET=tu_api_secret_aqui
```

**En Render:**
- Ve a tu proyecto en Render
- Settings → Environment
- Agrega estas 3 variables:
  - `CLOUDINARY_CLOUD_NAME` = tu cloud name
  - `CLOUDINARY_API_KEY` = tu api key
  - `CLOUDINARY_API_SECRET` = tu api secret

## ¡Listo! 🎉

Una vez configurado, tu sitio funcionará exactamente igual pero los videos serán permanentes.

## Plan Gratuito de Cloudinary
- ✅ 25GB de almacenamiento
- ✅ 25GB de ancho de banda mensual
- ✅ Más que suficiente para tu liga

## Soporte
Si tienes algún problema, avísame y te ayudo a configurarlo.
