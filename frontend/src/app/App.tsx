import { EphemerisStatus, ScenarioHeader } from '../features/scenario-form';
import { SitePicker } from '../features/site-picker';
import { AppLayout } from './layout/AppLayout';

function App() {
  return (
    <AppLayout sidebar={<SitePicker />}>
      <ScenarioHeader />
      <EphemerisStatus />
    </AppLayout>
  );
}

export default App;
