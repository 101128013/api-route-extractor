import type { RequestHistoryItem } from '../types';

export class HistoryService {
  private static STORAGE_KEY = 'api-extractor-request-history';
  private static MAX_HISTORY_ITEMS = 1000;

  static getHistory(): RequestHistoryItem[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  static getHistoryForEndpoint(endpointId: string, limit: number = 50): RequestHistoryItem[] {
    return this.getHistory()
      .filter(item => item.endpointId === endpointId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  static getHistoryForCollection(collectionId: string, limit: number = 100): RequestHistoryItem[] {
    return this.getHistory()
      .filter(item => item.collectionId === collectionId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  static addHistoryItem(item: RequestHistoryItem): void {
    const history = this.getHistory();
    history.unshift(item);
    
    // Keep only the most recent items
    if (history.length > this.MAX_HISTORY_ITEMS) {
      history.splice(this.MAX_HISTORY_ITEMS);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  static deleteHistoryItem(id: string): void {
    const history = this.getHistory().filter(item => item.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  static clearHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  static clearHistoryForEndpoint(endpointId: string): void {
    const history = this.getHistory().filter(item => item.endpointId !== endpointId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
  }

  static searchHistory(query: string): RequestHistoryItem[] {
    const history = this.getHistory();
    const lowerQuery = query.toLowerCase();
    return history.filter(item => 
      item.request.url.toLowerCase().includes(lowerQuery) ||
      item.request.method.toLowerCase().includes(lowerQuery) ||
      (item.response.body && item.response.body.toLowerCase().includes(lowerQuery))
    );
  }

  static getHistoryStats(): {
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  } {
    const history = this.getHistory();
    const successful = history.filter(item => item.success).length;
    const failed = history.filter(item => !item.success).length;
    const durations = history.map(item => item.response.duration).filter(d => d > 0);
    const averageDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    return {
      total: history.length,
      successful,
      failed,
      averageDuration: Math.round(averageDuration),
    };
  }
}

