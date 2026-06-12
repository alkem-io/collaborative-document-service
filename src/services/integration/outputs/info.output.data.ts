import { BaseOutputData } from './base.output.data';

export class InfoOutputData extends BaseOutputData {
  constructor(
    public read: boolean,
    public update: boolean,
    public isMultiUser: boolean,
    public maxCollaborators: number
  ) {
    super('info-output');
  }
}
