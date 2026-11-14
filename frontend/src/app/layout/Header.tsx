import { USING_MOCK } from '../../services/lunarApi';
import { DataSourceBadge } from '../../shared/ui/DataSourceBadge';

export function Header() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 px-4 py-3 sm:px-6">
      <div>
        <h1 className="text-xl font-bold text-orange-600">Bosón de Quásar</h1>
        <p className="text-sm font-semibold text-slate-900">Lunar Landing</p>
      </div>
      {USING_MOCK && <DataSourceBadge />}
    </header>
  );
}
