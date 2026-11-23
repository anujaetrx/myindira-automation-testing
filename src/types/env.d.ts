declare namespace NodeJS {
  interface ProcessEnv {
    TEST_ENV?: 'dev' | 'qa' | 'staging';
    CI?: string;
    BASE_URL?: string;
    API_BASE_URL?: string;
    AUTH_STRATEGY?: 'ui' | 'api';
    AUTH_LOGIN_ENDPOINT?: string;
    AUTH_TOKEN_STORAGE_KEY?: string;
    ADMIN_USERNAME?: string;
    ADMIN_PASSWORD?: string;
    USER_USERNAME?: string;
    USER_PASSWORD?: string;
    LOG_LEVEL?: 'error' | 'warn' | 'info' | 'debug';
    HEADLESS?: 'true' | 'false';
  }
}
