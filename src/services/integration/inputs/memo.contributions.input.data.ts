import { UserInfo } from '../types';
import { BaseInputData } from './base.input.data';

export class MemoContributionsInputData extends BaseInputData {
  constructor(
    public memoId: string,
    public users: UserInfo[]
  ) {
    super('memo-contributions');
  }
}
