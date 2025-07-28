import { BaseOutputData } from './base.output.data';

export enum FetchErrorCodes {
  NOT_FOUND = 'not_found',
  INTERNAL_ERROR = 'internal_error',
}

export class FetchOutputData extends BaseOutputData {
  constructor(public data: FetchContentData | FetchErrorData) {
    super('fetch-output');
  }
}

export class FetchContentData {
  constructor(public content: string) {}
}

export class FetchErrorData {
  constructor(
    public error: string,
    public code: FetchErrorCodes
  ) {}
}

export const isFetchErrorData = (
  data: FetchContentData | FetchErrorData
): data is FetchErrorData => {
  return (data as FetchErrorData).error !== undefined;
};
