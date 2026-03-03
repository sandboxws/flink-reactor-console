// ---------------------------------------------------------------------------
// Tap types — mirrors core TapManifest/TapMetadata types from src/core/types.ts
// for use within the dashboard. Kept in sync with the core type definitions.
// ---------------------------------------------------------------------------

/** Offset mode for tap observation queries */
export type TapOffsetMode = "latest" | "earliest" | "timestamp"

/** Configuration for an operator tap point */
export interface TapConfig {
  readonly name: string
  readonly groupIdPrefix: string
  readonly offsetMode: TapOffsetMode
  readonly startTimestamp: string
  readonly endTimestamp: string
}

/** Metadata describing how to observe a tapped operator's output stream */
export interface TapMetadata {
  readonly nodeId: string
  readonly name: string
  readonly componentType: string
  readonly componentName: string
  readonly schema: Record<string, string>
  readonly connectorType: string
  readonly observationSql: string
  readonly consumerGroupId: string
  readonly config: TapConfig
  readonly connectorProperties: Record<string, string>
}

/** Manifest file emitted alongside synthesized SQL for all tap points */
export interface TapManifest {
  readonly pipelineName: string
  readonly flinkVersion: string
  readonly generatedAt: string
  readonly taps: TapMetadata[]
}
