import { MetricsPanel } from '../features/metrics';
import { EphemerisStatus, ScenarioHeader } from '../features/scenario-form';
import { SitePicker } from '../features/site-picker';
import { SkyPanorama } from '../features/sky-panorama';
import { AppLayout } from './layout/AppLayout';

function App() {
  return (
    <AppLayout sidebar={<SitePicker />}>
      <ScenarioHeader />
      <EphemerisStatus />
      <SkyPanorama />
      <MetricsPanel />
    </AppLayout>
  );
}

export default App;
