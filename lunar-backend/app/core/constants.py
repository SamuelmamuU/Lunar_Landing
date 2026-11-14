"""Constantes físicas y geodésicas de referencia lunar (marco MOON_ME)."""

R_MOON_M: float = 1_737_400.0
R_MOON_KM: float = 1_737.4
R_SUN_KM: float = 696_000.0
R_EARTH_KM: float = 6_371.0
SOLAR_CONSTANT_W_M2: float = 1_361.0
AU_KM: float = 149_597_870.7

MOON_SP_STERE_PROJ: str = (
    "+proj=stere +lat_0=-90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +R=1737400 +units=m +no_defs"
)
MOON_LONGLAT_PROJ: str = "+proj=longlat +R=1737400 +no_defs"
MOON_FRAME: str = "MOON_ME"
AZIMUTH_REFERENCE: str = "north=0,clockwise; at pole north:=toward lon 0"
POWER_DISCLAIMER: str = "Energía estimada con modelo simplificado; no apto para diseño de vuelo."
PROBLEM_TYPE_BASE: str = "https://lunar-sim/errors/"
