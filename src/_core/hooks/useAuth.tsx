type User = {
  id: number;
  name: string;
  email: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
};

export function useAuth(): AuthState {
  return {
    user: {
      id: 1,
      name: "Jamie Lee",
      email: "jamie@chickenpos.test",
    },
    loading: false,
    isAuthenticated: true,
    logout: () => {},
  };
}
