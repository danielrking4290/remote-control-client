import axios from 'axios';
import { Point } from '../interfaces/point';
const API_BASE_URL = 'http://192.168.0.123:3000';

export interface TypeKeyResponse {
  message: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async moveMouse(dx: number, dy: number): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/move-mouse`, { dx, dy });
    } catch (error) {
      console.error('Error moving mouse:', error);
      throw error;
    }
  }

  async typeKey(key: string): Promise<TypeKeyResponse> {
    try {
      const response = await axios.get<TypeKeyResponse>(`${this.baseUrl}/type-key`, {
        params: { key }
      });
      return response.data;
    } catch (error) {
      console.error('Error typing key:', error);
      throw error;
    }
  }

  async getMousePosition(): Promise<Point> {
    try {
      const response = await axios.get<Point>(`${this.baseUrl}/get-mouse-position`);
      return response.data;
    } catch (error) {
      console.error('Error getting mouse position:', error);
      throw error;
    }
  }

  async clickMouse(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/click-mouse`);
    } catch (error) {
      console.error('Error clicking mouse:', error);
      throw error;
    }
  }

  async mouseDown(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/mouse-down`);
    } catch (error) {
      console.error('Error pressing mouse button:', error);
      throw error;
    }
  }

  async mouseUp(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/mouse-up`);
    } catch (error) {
      console.error('Error releasing mouse button:', error);
      throw error;
    }
  }

  async rightClickMouse(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/right-click-mouse`);
    } catch (error) {
      console.error('Error performing right click:', error);
      throw error;
    }
  }

  async getScreenSize(): Promise<{ width: number; height: number }> {
    try {
      const response = await axios.get<{ width: number; height: number }>(`${this.baseUrl}/get-screen-size`);
      return response.data;
    } catch (error) {
      console.error('Error getting screen size:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();