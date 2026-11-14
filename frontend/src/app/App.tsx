import { SitePicker } from '../features/site-picker/SitePicker';
import { USING_MOCK } from '../services/lunarApi';
import { ActiveScenarioSummary } from './ActiveScenarioSummary';

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-200 text-slate-900 lg:h-screen">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-4 py-3 sm:px-6">
        <div>
          <h1 className="text-xl font-bold text-orange-600">Bosón de Quásar</h1>
          <p className="text-sm font-semibold text-slate-900">Lunar Landing</p>
        </div>
        {USING_MOCK && (
          <p
            role="status"
            className="rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
          >
            Datos sinteticos: no usar para decisiones reales
          </p>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex max-h-[60vh] flex-col border-b border-slate-300 bg-slate-100 p-4 sm:px-6 lg:max-h-none lg:w-96 lg:shrink-0 lg:border-r lg:border-b-0">
          <SitePicker />
        </aside>

        <main className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <ActiveScenarioSummary />
        </main>
      </div>
    </div>
  );
}

export default App;
