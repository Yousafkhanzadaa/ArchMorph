type WebMCPToolAnnotations = {
  readOnlyHint?: boolean;
  untrustedContentHint?: boolean;
};

type WebMCPToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  execute: (
    input: Record<string, unknown>,
    options?: { signal: AbortSignal },
  ) => Promise<unknown> | unknown;
};

interface Document {
  modelContext?: {
    registerTool: (
      tool: WebMCPToolDefinition,
      options?: { exposedTo?: string[]; signal?: AbortSignal },
    ) => Promise<void> | void;
  };
}

interface Window {
  __archMorph?: {
    getProject: () => unknown;
    listTools: () => string[];
    invokeTool: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  };
}
