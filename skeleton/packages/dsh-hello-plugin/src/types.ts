/** Public payload types of the plugin Remote surface. */

/** One example business record. */
export interface HelloRecord {
  readonly id: string
  readonly message: string
}

/** Snapshot served to the UI. */
export interface HelloSnapshot {
  readonly records: readonly HelloRecord[]
}
