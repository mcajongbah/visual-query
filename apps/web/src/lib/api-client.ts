import type { DatabaseSchema } from "@/types/db";
import axios, { type AxiosError, type AxiosInstance } from "axios";

export type DatabaseDialect = "postgres" | "mysql";

export type ConnectionResponse = {
  sessionId: string;
  status: string;
};

export type QueryResults = {
  columns: { id: string; header: string; dataType?: string }[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
};

export type ConnectToDatabaseParams = {
  dialect: DatabaseDialect;
  connectionString: string;
};

export type ExecuteQueryParams = {
  sql: string;
};

export type DisconnectParams = {
  sessionId: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ConnectionError extends ApiError {
  constructor(message: string, statusCode?: number, data?: unknown) {
    super(message, statusCode, data);
    this.name = "ConnectionError";
  }
}

export class QueryExecutionError extends ApiError {
  constructor(message: string, statusCode?: number, data?: unknown) {
    super(message, statusCode, data);
    this.name = "QueryExecutionError";
  }
}

export class SchemaFetchError extends ApiError {
  constructor(message: string, statusCode?: number, data?: unknown) {
    super(message, statusCode, data);
    this.name = "SchemaFetchError";
  }
}

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // Log requests in development mode
    if (import.meta.env.DEV) {
      console.log(
        `[API Request] ${config.method?.toUpperCase()} ${config.url}`
      );
      if (config.data) {
        console.log("[API Request Data]", config.data);
      }
    }

    // Add authentication token if available (future enhancement)
    // const token = localStorage.getItem('auth_token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    // Log responses in development mode
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.url}`, response.data);
    }
    return response;
  },
  (error: AxiosError<{ error?: string; message?: string }>) => {
    // Log errors in development mode
    if (import.meta.env.DEV) {
      console.error("[API Response Error]", {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    // Handle different status codes
    if (error.response?.status === 401) {
      // Handle unauthorized - maybe redirect to login
      console.error("Unauthorized access");
    } else if (error.response?.status === 403) {
      console.error("Forbidden access");
    } else if (error.response?.status === 404) {
      console.error("Resource not found");
    } else if (error.response?.status === 500) {
      console.error("Server error");
    } else if (error.code === "ECONNABORTED") {
      console.error("Request timeout");
    } else if (error.code === "ERR_NETWORK") {
      console.error("Network error - please check your connection");
    }

    return Promise.reject(error);
  }
);

export async function connectToDatabase(
  params: ConnectToDatabaseParams
): Promise<{ sessionId: string; schema: DatabaseSchema }> {
  try {
    // Test connection
    const { data: connectionData } = await apiClient.post<ConnectionResponse>(
      "/api/connect",
      {
        dialect: params.dialect,
        connectionString: params.connectionString,
      }
    );

    const { sessionId } = connectionData;

    // Get schema
    try {
      const { data: schema } = await apiClient.post<DatabaseSchema>(
        "/api/schema",
        { sessionId }
      );

      return { sessionId, schema };
    } catch (error) {
      // If schema fetch fails, throw a specific error
      const axiosError = error as AxiosError<{ error?: string }>;
      const message =
        axiosError.response?.data?.error || "Failed to fetch database schema";
      throw new SchemaFetchError(
        message,
        axiosError.response?.status,
        axiosError.response?.data
      );
    }
  } catch (error) {
    // If it's already a SchemaFetchError, re-throw it
    if (error instanceof SchemaFetchError) {
      throw error;
    }

    // Otherwise, it's a connection error
    const axiosError = error as AxiosError<{ error?: string }>;
    const message =
      axiosError.response?.data?.error || "Failed to connect to database";
    throw new ConnectionError(
      message,
      axiosError.response?.status,
      axiosError.response?.data
    );
  }
}

export async function executeQuery(
  params: ExecuteQueryParams
): Promise<QueryResults> {
  try {
    const { data } = await apiClient.post<QueryResults>("/api/query", {
      sql: params.sql,
    });

    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string }>;
    const message =
      axiosError.response?.data?.error || "Failed to execute query";
    throw new QueryExecutionError(
      message,
      axiosError.response?.status,
      axiosError.response?.data
    );
  }
}

export async function disconnect(params: DisconnectParams): Promise<void> {
  try {
    await apiClient.post("/api/disconnect", {
      sessionId: params.sessionId,
    });
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string }>;
    const message =
      axiosError.response?.data?.error || "Failed to disconnect from database";
    throw new ApiError(
      message,
      axiosError.response?.status,
      axiosError.response?.data
    );
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function getApiClient(): AxiosInstance {
  return apiClient;
}

export default apiClient;
