
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface MinxCategory {
  id: string;
  name: string;
}

export interface MinxListing {
  id: number;
  title: string;
  category: string;
  category_id: string;
  price: number;
  oldPrice: number;
  condition: string;
  location: string;
  time: string;
  image: string;
  color: string;
  tag: string;
}

export interface ListingsResponse {
  items: MinxListing[];
  total: number;
  limit?: number;
  offset?: number;
}

export interface ListingsQuery {
  search?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

async function apiRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `MINX API request failed: ${response.status} ${response.statusText}`,
    );
  }

  return (await response.json()) as T;
}

export function getCategories(): Promise<MinxCategory[]> {
  return apiRequest<MinxCategory[]>("/api/categories");
}

export function getListings(
  query: ListingsQuery = {},
): Promise<ListingsResponse> {
  const params = new URLSearchParams();

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }

  if (query.category?.trim()) {
    params.set("category", query.category.trim());
  }

  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }

  if (query.offset !== undefined) {
    params.set("offset", String(query.offset));
  }

  const queryString = params.toString();
  const path = queryString
    ? `/api/listings?${queryString}`
    : "/api/listings";

  return apiRequest<ListingsResponse>(path);
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const result = await apiRequest<{ status: string }>(
      "/api/health",
    );

    return result.status === "healthy";
  } catch {
    return false;
  }
}
