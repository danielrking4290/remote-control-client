import axios from 'axios';
import { Point } from '../interfaces/point';
const API_BASE_URL = 'http://192.168.50.119:3000';

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

  async scrollMouse(dx: number, dy: number): Promise<void> {
    try {
      await axios.post(`${this.baseUrl}/scroll-mouse`, { dx, dy });
    } catch (error) {
      console.error('Error scrolling mouse:', error);
      throw error;
    }
  }

  async switchWindow(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/switch-window`);
    } catch (error) {
      console.error('Error switching window:', error);
      throw error;
    }
  }

  async closeWindow(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/close-window`);
    } catch (error) {
      console.error('Error closing window:', error);
      throw error;
    }
  }

  async viewAllWindows(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/view-all-windows`);
    } catch (error) {
      console.error('Error viewing all windows:', error);
      throw error;
    }
  }

  async refreshPage(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/refresh-page`);
    } catch (error) {
      console.error('Error refreshing page:', error);
      throw error;
    }
  }

  async mediaNext(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/media-next`);
    } catch (error) {
      console.error('Error media next:', error);
      throw error;
    }
  }

  async mediaPrevious(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/media-previous`);
    } catch (error) {
      console.error('Error media previous:', error);
      throw error;
    }
  }

  async mediaPlayPause(): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/media-play-pause`);
    } catch (error) {
      console.error('Error media play/pause:', error);
      throw error;
    }
  }

  async mediaVolumeUp(steps: number = 1): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/media-volume-up`, {
        params: steps > 1 ? { steps } : {}
      });
    } catch (error) {
      console.error('Error media volume up:', error);
      throw error;
    }
  }

  async mediaVolumeDown(steps: number = 1): Promise<void> {
    try {
      await axios.get(`${this.baseUrl}/media-volume-down`, {
        params: steps > 1 ? { steps } : {}
      });
    } catch (error) {
      console.error('Error media volume down:', error);
      throw error;
    }
  }

  /** Discrete scroll step (uses scroll-mouse with fixed delta). */
  async scrollUp(): Promise<void> {
    await this.scrollMouse(0, 3);
  }

  async scrollDown(): Promise<void> {
    await this.scrollMouse(0, -3);
  }

  async scrollLeft(): Promise<void> {
    await this.scrollMouse(-3, 0);
  }

  async scrollRight(): Promise<void> {
    await this.scrollMouse(3, 0);
  }
}

export const apiService = new ApiService();