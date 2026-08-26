type WebMCPToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

type WebMCPToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: WebMCPToolAnnotations;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
};

interface Document {
  modelContext?: {
    registerTool: (tool: WebMCPToolDefinition) => Promise<void> | void;
    unregisterTool?: (name: string) => Promise<void> | void;
  };
}

interface Window {
  __archMorph?: {
    getProject: () => unknown;
    listTools: () => string[];
    invokeTool: (name: string, input?: Record<string, unknown>) => Promise<unknown>;
  };
}
