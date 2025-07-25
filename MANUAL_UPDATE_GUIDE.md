# Guía de Actualización Manual - Liga Panameña de Clubes Pro

## Descripción
El sistema ahora funciona sin panel de administración. Las tablas de posiciones y partidos se actualizan manualmente desde el código del servidor, mientras que los clips mantienen toda su funcionalidad automática con actualizaciones en tiempo real.

## Funciones Disponibles

### 1. Actualizar Tabla de Posiciones
```javascript
updateStandings([
    { position: 1, team: 'ACP 507', played: 5, won: 4, drawn: 1, lost: 0, goalsFor: 12, goalsAgainst: 3, goalDifference: 9, points: 13 },
    { position: 2, team: 'Coiner FC', played: 5, won: 3, drawn: 2, lost: 0, goalsFor: 10, goalsAgainst: 4, goalDifference: 6, points: 11 },
    // ... resto de equipos
]);
```

### 2. Actualizar Lista Completa de Partidos
```javascript
updateMatches([
    {
        id: '1',
        homeTeam: 'ACP 507',
        awayTeam: 'Coiner FC',
        homeScore: 2,
        awayScore: 1,
        date: '2025-01-15',
        time: '15:00',
        venue: 'Estadio ACP',
        status: 'finished',
        matchday: 1
    },
    // ... más partidos
]);
```

### 3. Agregar Nuevo Partido
```javascript
addMatch({
    homeTeam: 'ACP 507',
    awayTeam: 'Punta Coco Fc',
    homeScore: 0,
    awayScore: 0,
    date: '2025-01-20',
    time: '16:00',
    venue: 'Estadio ACP',
    status: 'upcoming',
    matchday: 5
});
```

### 4. Actualizar Partido Específico
```javascript
updateMatch('1', {
    homeScore: 3,
    awayScore: 1,
    status: 'finished'
});
```

## Equipos de la Liga
1. ACP 507
2. Coiner FC
3. FC WEST SIDE
4. Humacao Fc
5. Punta Coco Fc
6. Pura Vibra
7. Raven Law
8. Rayos X Fc
9. Tiki Taka Fc
10. fly city

## Actualizaciones en Tiempo Real
- Todas las funciones emiten automáticamente las actualizaciones a los clientes conectados
- Los cambios se reflejan inmediatamente en todas las páginas abiertas
- Los clips mantienen su funcionalidad completa de subida, visualización y estadísticas

## Uso
1. Ejecutar el servidor: `npm start` o `node server.js`
2. Abrir la consola del servidor
3. Usar las funciones globales para actualizar datos
4. Los cambios se emiten automáticamente a todos los clientes conectados

## Funcionalidad de Clips
- ✅ Subida de clips (mantiene funcionalidad completa)
- ✅ Visualización en tiempo real
- ✅ Sistema de likes
- ✅ Conteo de visualizaciones
- ✅ Estadísticas automáticas
- ✅ Streaming de video
- ✅ Actualizaciones en tiempo real

## Datos Estáticos (Solo Lectura desde API)
- ❌ Tabla de posiciones (actualización manual)
- ❌ Partidos (actualización manual)
- ❌ Configuración de liga (actualización manual)
- ✅ Lista de equipos (estática)
