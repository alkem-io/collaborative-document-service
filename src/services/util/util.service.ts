import { Doc as YjsDoc } from 'yjs';
import { Injectable } from '@nestjs/common';
import { NotProvidedException } from '@common/exceptions';
import { LogContext } from '@common/enums';
import { UserInfo } from '../integration/types';
import { FetchInputData, SaveInputData, WhoInputData } from '../integration/inputs';
import { isFetchErrorData } from '../integration/outputs';
import { IntegrationService } from '../integration';
import { FetchException } from '@src/services/util/fetch.exception';

import { Editor } from '@tiptap/core';
import Collaboration from '@tiptap/extension-collaboration';

@Injectable()
export class UtilService {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * Fetches user information based on the provided cookie or authorization header.
   * If both are provided, authorization header takes precedence.
   * @throws NotProvidedException if neither is provided.
   * @param opts
   */
  public async getUserInfo(opts: {
    cookie?: string;
    authorization?: string;
  }): Promise<UserInfo | never> {
    const { cookie, authorization } = opts;
    // we want to choose the authorization with priority
    if (authorization) {
      return this.integrationService.who(new WhoInputData({ authorization }));
    }

    if (cookie) {
      return this.integrationService.who(new WhoInputData({ cookie }));
    }

    throw new NotProvidedException(
      'Not able to get user info. At least one of: Cookie and Authorization headers need not be provided',
      LogContext.INTEGRATION
    );
  }

  public save(documentId: string, document: YjsDoc) {
    const markdown = yjsDocToMarkdown(document);
    return this.integrationService.save(new SaveInputData(documentId, markdown));
  }

  /**
   * Fetches the content of the Y.doc from DB
   * @param documentId Document ID
   * @throws FetchException if the fetch fails
   */
  public async fetchMemo(documentId: string): Promise<YjsDoc> {
    const { data } = await this.integrationService.fetch(new FetchInputData(documentId));

    if (isFetchErrorData(data)) {
      throw new FetchException('Failed to fetch memo', LogContext.UTIL, {
        originalError: data.error,
        code: data.code,
      });
    }

    return markdownToYjsDoc(data.content);
  }
}

const markdownToYjsDoc = (markdown: string): YjsDoc => {
  const doc = new YjsDoc();
  // const yText = doc.getText('default');
  // yText.insert(0, markdown);
  return doc;
};

const yjsDocToMarkdown = (doc: YjsDoc): string => {
  const editor = new Editor({
    extensions: [
      Collaboration.configure({
        document: doc,
        field: 'default',
      }),
    ],
    editable: false,
  });

  // The editor's getText() returns the Markdown string
  return editor.getText();
};
