import type { Collection, Folder, Workspace } from '../types';

export class CollectionService {
  private static STORAGE_KEY_COLLECTIONS = 'api-extractor-collections';
  private static STORAGE_KEY_WORKSPACES = 'api-extractor-workspaces';
  private static STORAGE_KEY_ACTIVE_WORKSPACE = 'api-extractor-active-workspace';

  // Collections
  static getCollections(): Collection[] {
    const data = localStorage.getItem(this.STORAGE_KEY_COLLECTIONS);
    return data ? JSON.parse(data) : [];
  }

  static getCollection(id: string): Collection | null {
    return this.getCollections().find(c => c.id === id) || null;
  }

  static saveCollection(collection: Collection): void {
    const collections = this.getCollections();
    const index = collections.findIndex(c => c.id === collection.id);
    if (index >= 0) {
      collections[index] = { ...collection, updatedAt: Date.now() };
    } else {
      collections.push({ 
        ...collection, 
        createdAt: Date.now(), 
        updatedAt: Date.now(),
        endpointIds: collection.endpointIds || [],
        folders: collection.folders || [],
        tags: collection.tags || []
      });
    }
    localStorage.setItem(this.STORAGE_KEY_COLLECTIONS, JSON.stringify(collections));
  }

  static deleteCollection(id: string): void {
    const collections = this.getCollections().filter(c => c.id !== id);
    localStorage.setItem(this.STORAGE_KEY_COLLECTIONS, JSON.stringify(collections));
  }

  static addEndpointToCollection(collectionId: string, endpointId: string): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection) {
      if (!collection.endpointIds.includes(endpointId)) {
        collection.endpointIds.push(endpointId);
        this.saveCollection(collection);
      }
    }
  }

  static removeEndpointFromCollection(collectionId: string, endpointId: string): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection) {
      collection.endpointIds = collection.endpointIds.filter(id => id !== endpointId);
      this.saveCollection(collection);
    }
  }

  static addTagToCollection(collectionId: string, tag: string): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection && !collection.tags.includes(tag)) {
      collection.tags.push(tag);
      this.saveCollection(collection);
    }
  }

  // Workspaces
  static getWorkspaces(): Workspace[] {
    const data = localStorage.getItem(this.STORAGE_KEY_WORKSPACES);
    return data ? JSON.parse(data) : [];
  }

  static getWorkspace(id: string): Workspace | null {
    return this.getWorkspaces().find(w => w.id === id) || null;
  }

  static getActiveWorkspace(): Workspace | null {
    const activeId = localStorage.getItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    if (!activeId) {
      // Create default workspace if none exists
      const workspaces = this.getWorkspaces();
      if (workspaces.length === 0) {
        const defaultWorkspace: Workspace = {
          id: 'default',
          name: 'Default Workspace',
          collectionIds: [],
          environmentIds: [],
          activeEnvironmentId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.saveWorkspace(defaultWorkspace);
        this.setActiveWorkspace(defaultWorkspace.id);
        return defaultWorkspace;
      }
      return workspaces[0];
    }
    return this.getWorkspaces().find(w => w.id === activeId) || null;
  }

  static setActiveWorkspace(workspaceId: string | null): void {
    if (workspaceId) {
      localStorage.setItem(this.STORAGE_KEY_ACTIVE_WORKSPACE, workspaceId);
    } else {
      localStorage.removeItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    }
  }

  static saveWorkspace(workspace: Workspace): void {
    const workspaces = this.getWorkspaces();
    const index = workspaces.findIndex(w => w.id === workspace.id);
    if (index >= 0) {
      workspaces[index] = { ...workspace, updatedAt: Date.now() };
    } else {
      workspaces.push({ 
        ...workspace, 
        createdAt: Date.now(), 
        updatedAt: Date.now(),
        collectionIds: workspace.collectionIds || [],
        environmentIds: workspace.environmentIds || []
      });
    }
    localStorage.setItem(this.STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
  }

  static deleteWorkspace(id: string): void {
    const workspaces = this.getWorkspaces().filter(w => w.id !== id);
    localStorage.setItem(this.STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
    const activeId = localStorage.getItem(this.STORAGE_KEY_ACTIVE_WORKSPACE);
    if (activeId === id) {
      const remaining = workspaces.length > 0 ? workspaces[0].id : null;
      this.setActiveWorkspace(remaining);
    }
  }

  static addCollectionToWorkspace(workspaceId: string, collectionId: string): void {
    const workspace = this.getWorkspaces().find(w => w.id === workspaceId);
    if (workspace && !workspace.collectionIds.includes(collectionId)) {
      workspace.collectionIds.push(collectionId);
      this.saveWorkspace(workspace);
    }
  }

  // Folders
  static addFolderToCollection(collectionId: string, folder: Folder): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection) {
      collection.folders.push(folder);
      this.saveCollection(collection);
    }
  }

  static removeFolderFromCollection(collectionId: string, folderId: string): void {
    const collection = this.getCollections().find(c => c.id === collectionId);
    if (collection) {
      collection.folders = collection.folders.filter(f => f.id !== folderId);
      this.saveCollection(collection);
    }
  }
}

