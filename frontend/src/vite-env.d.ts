interface ImportMetaEnv {
  /** 'false' para pegarle al backend real. Cualquier otro valor (o vacio) usa mocks. */
  readonly VITE_USE_MOCK?: string;
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
