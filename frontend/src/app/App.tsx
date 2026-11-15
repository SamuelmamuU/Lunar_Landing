import { EphemerisStatus, ScenarioHeader } from '../features/scenario-form';
import { SitePicker } from '../features/site-picker';
// Aviso de datos sinteticos oculto por ahora; descomentar junto con <DataSourceBadge /> abajo.
// import { USING_MOCK } from '../services/lunarApi';
// import { DataSourceBadge } from '../shared/ui/DataSourceBadge';
import { AppLayout } from './layout/AppLayout';

function App() {
  return (
    <AppLayout sidebar={<SitePicker />}>
      {/* {USING_MOCK && <DataSourceBadge />} */}
      <ScenarioHeader />
      <EphemerisStatus />
    </AppLayout>
  );
}

export default App;
