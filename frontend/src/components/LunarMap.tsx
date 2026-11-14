import { useState } from 'react'
import {
    MapContainer,
    TileLayer,
    Marker,
    useMapEvents
} from 'react-leaflet'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const NASA_TILE_URL = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'

interface Coordinates {
    lat: number
    lon: number
}

function MapClick({ onSelect }: { onSelect: (coords: Coordinates) => void }) {
    useMapEvents({
        click(event) {
            onSelect({
                lat: event.latlng.lat,
                lon: event.latlng.lng
            })
        }
    })

    return null
}

export default function LunarMap() {
    const [coords, setCoords] = useState<Coordinates>({
        lat: 0,
        lon: 0
    })

    return (
        <div className="w-full space-y-4">
            {/* Control de coordenadas */}
            <div className="flex flex-wrap gap-4">
                <label className="text-sm font-medium text-slate-300">
                    Latitude
                    <input
                        type="number"
                        min={-90}
                        max={90}
                        step={0.1}
                        value={coords.lat}
                        onChange={(e) =>
                            setCoords({
                                ...coords, 
                                lat: Number(e.target.value)
                            })
                        }
                        className="block mt-1 border border-slate-700 bg-slate-900 rounded p-2 text-white"
                    />
                </label>

                <label className="text-sm font-medium text-slate-300">
                    Longitude
                    <input
                        type="number"
                        min={-180}
                        max={180}
                        step={0.1}
                        value={coords.lon}
                        onChange={(e) =>
                            setCoords({
                                ...coords, 
                                lon: Number(e.target.value)
                            })
                        }
                        className="block mt-1 border border-slate-700 bg-slate-900 rounded p-2 text-white"
                    />
                </label>
            </div>

            <MapContainer
                crs={L.CRS.EPSG4326}
                center={[coords.lat, coords.lon]}
                zoom={2}
                minZoom={0}
                maxZoom={8}
                scrollWheelZoom={true}
                className="w-full h-[600px] rounded-xl border border-slate-800"
            >
                <TileLayer
                    url={NASA_TILE_URL}
                    attribution="Imagery: NASA / LRO / JPL"
                    minZoom={0}
                    maxNativeZoom={8}
                    noWrap={true}
                />
                <Marker position={[coords.lat, coords.lon]} />
                <MapClick onSelect={setCoords} />
            </MapContainer>

            <p className="text-sm text-slate-300">
                Latitude: {coords.lat.toFixed(3)} | Longitude: {coords.lon.toFixed(3)}
            </p>
        </div>
    )
}