import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// --- In-memory access token (NOT in storage — immune to XSS) ---
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
    accessToken = token;
}

export function getAccessToken(): string | null {
    return accessToken;
}

// --- Shared axios instance ---
const axiosInstance = axios.create({
    baseURL: BASE_URL,
    withCredentials: true, // send httpOnly cookies on every request
});

// Flag to prevent multiple concurrent refresh calls
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
}> = [];

function processQueue(error: any, token: string | null = null) {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token!);
        }
    });
    failedQueue = [];
}

// --- Request interceptor: attach access token ---
axiosInstance.interceptors.request.use(
    (config) => {
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// --- Response interceptor: handle 401 → silent refresh ---
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If the failed request is not a 401, or is the refresh call itself, reject immediately
        if (
            error.response?.status !== 401 ||
            originalRequest._retry ||
            originalRequest.url?.includes('/api/login/refresh')
        ) {
            return Promise.reject(error);
        }

        // If another refresh is already in flight, queue this request
        if (isRefreshing) {
            return new Promise<string>((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            }).then((newToken) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return axiosInstance(originalRequest);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            // Attempt to refresh (cookie is sent automatically)
            const { data } = await axios.post(
                `${BASE_URL}/api/login/refresh`,
                {},
                { withCredentials: true }
            );

            const newToken = data.token;
            setAccessToken(newToken);

            // Retry all queued requests
            processQueue(null, newToken);

            // Retry the original failed request
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return axiosInstance(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError, null);
            setAccessToken(null);

            // Redirect to login
            sessionStorage.clear();
            window.location.href = '/';

            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);

export default axiosInstance;
