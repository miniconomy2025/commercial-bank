const BASE_URL = 'https://commercial-bank.projects.bbdgrad.com/api';

const urlParams = new URLSearchParams(window.location.search);
const clientId = urlParams.get('clientId');

export async function apiGet<T>(endpoint: string): Promise<T> {
  try {
    const hasQuery = endpoint.includes('?');
    const url = `${BASE_URL}${endpoint}${hasQuery ? '&' : '?'}clientId=${clientId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Client-Id': 'Commercial-Bank'
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GET ${endpoint} failed: ${response.status} ${errorBody}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API GET error:', error);
    throw error;
  }
}

export async function apiPost<T>(endpoint: string, body: any): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`POST ${endpoint} failed: ${response.status} ${errorBody}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API POST error:', error);
    throw error;
  }
}
