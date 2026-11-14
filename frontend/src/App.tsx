function App() {
  return (
    <main className="flex flex-col min-h-screen items-center justify-center bg-slate-200 text-orange-600 ">
      <h1 className="text-4xl font-bold">Bosón de Quásar</h1>
      <span className="text-black text-sm font-semibold">Lunar Landing</span>

      <div className="max-w-5xl mx-auto">
        <img 
        src="/moon/MOON_lroc_color_2k.jpg" 
        alt="Superficie lunar" 
        className="w-full rounded-lg"/>
      </div>
    </main>
  )
}

export default App
