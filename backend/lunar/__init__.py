"""Lunar Landing Site Navigator — backend de cálculos.

Módulos:
  config    rutas y constantes
  kernels   carga de kernels SPICE (DE440 si existe, si no DE421)
  sites     catálogo de sitios y coordenadas personalizadas
  horizon   máscaras de horizonte (esfera lisa o DEM de LOLA)
  geometry  azimut/elevación del Sol y la Tierra con SPICE
  analysis  series, eventos, métricas y semáforo
  export    archivos de datos para el frontend
"""
__version__ = "0.1.0"
