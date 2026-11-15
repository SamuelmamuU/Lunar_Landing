import { useState } from 'react';

/**
 * Texto editable de un campo cuyo valor "oficial" vive en el store.
 * Mientras el usuario escribe se guarda el borrador (aunque sea invalido); si el valor del store
 * cambia por otro lado (p. ej. "Usar fecha de alunizaje"), el borrador se reemplaza.
 */
export function useSyncedDraft(value: string) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);

  // Ajuste durante el render (patron recomendado por React en vez de un useEffect).
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  return [draft, setDraft] as const;
}
