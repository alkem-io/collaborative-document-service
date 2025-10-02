// thrown by cancelling a timer via the abort controller
export class AbortError extends Error {
  constructor(
    public message: string,
    public code: string,
    public cause: string
  ) {
    super();
  }
}
