import { NorthStarMetricContext } from './north-star-metric';
import { AuthenticationContext } from './authentication/types';

type ContextUnion = NorthStarMetricContext & AuthenticationContext;

/**
 * The format of the data attached to each connection's context along the extension chain.
 * It represents a union of all the fields added by the various extensions.
 * The existence of each field can vary depending on which part of the chain the context is accessed.
 * Extensions should always check for the existence of a field before using it.
 */
export type ConnectionContext = Partial<ContextUnion>;
// export type WithConnectionContext = { context: ConnectionContext };
export type WithConnectionContext<T> = Omit<T, 'context'> & { context: ConnectionContext };
