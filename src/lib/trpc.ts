type QueryResult<T> = {
  data: T | undefined;
};

const emptyQuery = <T,>(): QueryResult<T> => ({ data: undefined });

export const trpc = {
  employee: {
    getByUserId: {
      useQuery: emptyQuery,
    },
  },
  cashDrawer: {
    getOpen: {
      useQuery: emptyQuery,
    },
  },
};
