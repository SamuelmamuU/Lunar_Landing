import { AddToCompareButton, ComparePanel } from '../features/compare';
import { MetricsPanel, WindowMetrics } from '../features/metrics';
import { EphemerisStatus, ScenarioHeader } from '../features/scenario-form';
import { SitePicker } from '../features/site-picker';
import { SkyPanorama } from '../features/sky-panorama';
import { Timeline } from '../features/timeline';
import { AppLayout } from './layout/AppLayout';

function App() {
  return (
    <AppLayout sidebar={<SitePicker />}>
      <ScenarioHeader actions={<AddToCompareButton />} />
      <EphemerisStatus />
      <SkyPanorama metrics={<WindowMetrics />} />
      <Timeline />
      <MetricsPanel />
      <ComparePanel />
    </AppLayout>
  );
}

export default App;
