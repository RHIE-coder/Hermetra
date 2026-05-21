export interface VarProfile {
  id: string;
  name: string;
}

export interface VarEntry {
  key: string;
  value?: string;
}

export interface VariablesDocument {
  profiles: VarProfile[];
  /** Profile id → variables (git-tracked) */
  sharedVariables: Record<string, VarEntry[]>;
  /** Profile id → keys only (git-tracked); values held locally */
  privateVariables: Record<string, VarEntry[]>;
}
