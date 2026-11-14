import { ActiveScenarioSummary } from '../features/scenario-form';
import { SitePicker } from '../features/site-picker';
// Aviso de datos sinteticos oculto por ahora; descomentar junto con <DataSourceBadge /> abajo.
// import { USING_MOCK } from '../services/lunarApi';
// import { DataSourceBadge } from '../shared/ui/DataSourceBadge';
import { AppLayout } from './layout/AppLayout';
import LunarMap from '../components/LunarMap';

function App() {
  return (
    <AppLayout sidebar={<SitePicker />}>
      {/* {USING_MOCK && <DataSourceBadge />} */}
      <ActiveScenarioSummary />
      <LunarMap/>
    </AppLayout>
  );
}

export default App;
