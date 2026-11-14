import LunarMap from "./components/LunarMap"

function App() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">
        Lunar Landing Site Navigator
      </h1>
      <p className="text-slate-400 mb-8">
        Navegador lunar de la superficie de la Luna (NASA LRO WAC)
      </p>
      <LunarMap />
    </main>
  )
}

export default App