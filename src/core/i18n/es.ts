// Diccionario base: define las claves que inglés debe cubrir.
export const es = {
  'search.placeholder': 'Buscar aquí…',
  'search.clear': 'Borrar búsqueda',
  'category.comedor': 'Comedor',
  'category.gimnasio': 'Gimnasio',
  'category.medico': 'Servicios médicos',
  'category.escolares': 'Servicios escolares',
  'category.biblioteca': 'Biblioteca',
  'category.internacional': 'Oficina internacional',
  'control.language': 'Idioma',
  'control.orientation.north': 'Norte',
  'control.orientation.heading': 'Rumbo',
  'control.orientation': 'Orientación del mapa',
  'control.myLocation': 'Mi ubicación',
  'map.placeholder': 'El mapa del campus aparecerá aquí',
  'data.loading': 'Cargando datos del campus…',
  'data.error': 'No se pudieron cargar los datos del campus',
  'data.summary': '{places} lugares · datos del {date}',
} as const;

export type MessageKey = keyof typeof es;
