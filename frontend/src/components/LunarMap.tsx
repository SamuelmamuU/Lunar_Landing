import { useEffect } from 'react'
import {
    MapContainer,
    TileLayer,
    Marker,
    useMap,
    useMapEvents
} from 'react-leaflet'

import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useAppStore } from '../app/store'

const NASA_TILE_URL = 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg'

interface Coordinates {
    lat: number
    lon: number
}

function MapController({ center }: { center: [number, number]}) {
    const map = useMap()
    useEffect(() => {
        map.setView(center, map.getZoom())
    }, [center, map])
    return null
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

    const activeScenario = useAppStore((s) => s.activeScenario)
    const selectSite = useAppStore((s) => s.selectSite)
    const addCustomSite = useAppStore((s) => s.addCustomSite)

    const lat = activeScenario?.site.lat ?? 0
    const lon = activeScenario?.site.lon ?? 0

    // const [coords, setCoords] = useState<Coordinates>({
    //     lat: 0,
    //     lon: 0
    // })

    const handleMapClick = ({ lat, lon }: Coordinates) => {
        const customSite = {
            id: `custom-${Date.now()}`, 
            name: `Punto(${lat.toFixed(2)}, ${lon.toFixed(2)})`,
            lat: lat, 
            lon: lon, 
            radiusKm: 5, 
            description: 'Sitio seleccionado desde el mapa'
        }
        addCustomSite(customSite)
        selectSite(customSite)
    }

    return (
        <div className="w-full h-full min-h-0 flex flex-col flex-1 gap-2">
            {/* Control de coordenadas
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
            </div> */}

            <MapContainer
                crs={L.CRS.EPSG4326}
                center={[lat, lon]}
                zoom={2}
                minZoom={0}
                maxZoom={8}
                scrollWheelZoom={true}
                className="w-full flex-1 min-h-0 rounded-xl border border-slate-800"
            >
                <MapController center={[lat, lon]}/>
                <TileLayer
                    url={NASA_TILE_URL}
                    attribution="Imagery: NASA / LRO / JPL"
                    minZoom={0}
                    maxNativeZoom={8}
                    noWrap={true}
                />
                <Marker position={[lat, lon]} />
                <MapClick onSelect={handleMapClick} />
            </MapContainer>

            <p className="text-sm text-slate-300">
                Latitude: {lat.toFixed(3)} | Longitude: {lon.toFixed(3)}
            </p>
        </div>
    )
}