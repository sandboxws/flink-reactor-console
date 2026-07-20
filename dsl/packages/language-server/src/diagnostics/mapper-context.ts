import type { PositionMap } from "../mappers/source-position-mapper.js"

/** The read-only context every finding is projected against: the source map for
 *  ranges, the document text for text-search fallbacks and prop narrowing, and
 *  the document URI for `relatedInformation` locations. */
export interface MapperContext {
  readonly positionMap: PositionMap
  readonly sourceText: string
  readonly uri: string
}
