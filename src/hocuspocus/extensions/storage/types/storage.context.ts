export type StorageContext = {
  saved: boolean;
  error?: string;
};

export type WithStorageContext<T extends { context: any }> = Omit<T, 'context'> & {
  context: StorageContext;
};
