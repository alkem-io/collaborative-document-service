/**
 * Represents an authenticated user in the system.
 *
 * Users are also actors — the `id` field serves as both the userId and the actorId.
 * These identifiers are interchangeable: any reference to a userId can be treated
 * as an actorId and vice versa. This is because every authenticated user is an actor
 * capable of performing actions (e.g., reading, editing) on documents.
 */
export type UserInfo = {
  /** The user/actor identifier. Interchangeable with actorId. */
  id: string;
};
